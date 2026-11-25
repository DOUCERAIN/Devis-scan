-- Inventaire du client : un objet du catalogue ajouté deux fois de suite dans la même pièce augmente la
-- quantité de la ligne existante au lieu d'en créer une seconde (appuis rapprochés sur « + »).
-- Remplace seulement la fonction public_inventory_add ; aucune donnée modifiée.
create or replace function public.public_inventory_add(token text, item jsonb)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  req public.quote_requests := private.request_for_any_token(token);
  cat_id text := nullif(trim(coalesce(item ->> 'catalog_key', '')), '');
  ref public.furniture_catalog;
  label text := nullif(trim(coalesce(item ->> 'label', '')), '');
  qty integer := coalesce(nullif(item ->> 'quantity', '')::integer, 1);
  w numeric := nullif(item ->> 'width_cm', '')::numeric;
  d numeric := nullif(item ->> 'depth_cm', '')::numeric;
  h numeric := nullif(item ->> 'height_cm', '')::numeric;
  size text := nullif(item ->> 'size', '');
  note text := nullif(trim(coalesce(item ->> 'comment', '')), '');
  room uuid;
  v record;
  new_item uuid;
begin
  perform private.inventory_editable(req);
  if qty not between 1 and 999 then raise exception 'Invalid quantity' using errcode = '22023'; end if;
  if (select count(*) from public.inventory_items i where i.request_id = req.id) >= 400 then
    raise exception 'Too many items' using errcode = '54000';
  end if;
  if cat_id is not null then
    select * into ref from public.furniture_catalog where id = cat_id;
    if ref.id is null then raise exception 'Unknown catalog item' using errcode = '22023'; end if;
    label := coalesce(label, ref.name);
  end if;
  if label is null or char_length(label) > 120 then raise exception 'A description is required' using errcode = '22023'; end if;
  if (w is not null or d is not null or h is not null)
     and (w is null or d is null or h is null or w not between 1 and 2000 or d not between 1 and 2000 or h not between 1 and 2000) then
    raise exception 'Invalid dimensions' using errcode = '22023';
  end if;
  if size is not null and size not in ('small', 'medium', 'large', 'xlarge') then raise exception 'Invalid size class' using errcode = '22023'; end if;
  if char_length(coalesce(note, '')) > 1000 then raise exception 'Comment too long' using errcode = '22023'; end if;

  if nullif(item ->> 'room_id', '') is not null then
    select id into room from public.rooms where id = (item ->> 'room_id')::uuid and request_id = req.id;
    if room is null then raise exception 'Unknown room' using errcode = '22023'; end if;
  else
    room := private.category_room(req, coalesce(item ->> 'category', 'autres'));
  end if;

  -- Même objet du catalogue déjà ajouté par le client dans la même pièce (sans dimensions, taille ni
  -- commentaire propres) : la quantité augmente au lieu de créer une seconde ligne (appuis rapprochés).
  if cat_id is not null and w is null and note is null then
    select id into new_item from public.inventory_items
     where request_id = req.id and room_id = room and catalog_key = cat_id and source = 'customer' and not removed
       and length_cm is null and customer_comment is null and size_class is not distinct from size
     order by created_at limit 1 for update;
    if new_item is not null then
      perform public.public_inventory_update(token, new_item, least(999, (select quantity from public.inventory_items where id = new_item) + qty));
      return new_item;
    end if;
  end if;

  select * into v from private.customer_item_volume(cat_id, w, d, h, size);
  insert into public.inventory_items (request_id, company_id, room_id, name, catalog_key, category, quantity, unit_volume_m3,
                                      unit_volume_min_m3, unit_volume_max_m3, geometric_volume_m3, volume_source, volume_note,
                                      length_cm, width_cm, height_cm, size_class, customer_comment, source, is_heavy)
  values (req.id, req.company_id, room, label, cat_id, nullif(item ->> 'category', ''), qty, v.unit, v.vmin, v.vmax, v.geometric,
          v.source, v.note, w, d, h, size, note, 'customer', coalesce(ref.heavy, false))
  returning id into new_item;

  -- Après l'analyse, chaque ajout du client est tracé (l'inventaire initial de l'IA reste consultable).
  if req.status = 'awaiting_customer' then
    insert into public.inventory_item_changes (item_id, request_id, company_id, action, actor, changes, volume_before_m3, volume_after_m3)
    values (new_item, req.id, req.company_id, 'add', 'customer', jsonb_build_object('name', label, 'quantity', qty), 0, qty * v.unit);
  end if;
  return new_item;
end;
$$;
