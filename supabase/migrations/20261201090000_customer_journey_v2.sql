-- =============================================================================
-- Parcours client v2 (01/12/2026) : dates alternatives multiples, profils particulier / entreprise,
-- consentements, méthode d'inventaire (vidéo ou manuel), inventaire saisi ou corrigé par le client,
-- volumes traçables pour les objets personnalisés, devis immédiat.
-- Migration NON destructive : ajouts de colonnes et de fonctions, contraintes élargies, report de
-- l'ancienne date alternative dans la nouvelle liste (l'ancienne colonne est conservée).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Demande : dates alternatives multiples, méthode d'inventaire
-- -----------------------------------------------------------------------------
alter table public.quote_requests
  add column alternative_moving_dates date[] not null default '{}' check (cardinality(alternative_moving_dates) <= 30),
  add column inventory_method text check (inventory_method in ('video', 'manual'));

update public.quote_requests
   set alternative_moving_dates = array[alternative_moving_date]
 where alternative_moving_date is not null and cardinality(alternative_moving_dates) = 0;

comment on column public.quote_requests.alternative_moving_dates is 'Dates alternatives proposées par le client (facultatives, 30 au plus). alternative_moving_date reste égale à la première, pour compatibilité.';
comment on column public.quote_requests.inventory_method is 'Méthode choisie par le client : video (vidéos analysées par l''IA) ou manual (inventaire saisi par catégories).';

-- La demande peut exister avant les coordonnées (étape 1 : déménagement ; étape 2 : coordonnées).

-- -----------------------------------------------------------------------------
-- Client : profil particulier ou entreprise, consentements
-- -----------------------------------------------------------------------------
alter table public.customers
  add column customer_type text not null default 'individual' check (customer_type in ('individual', 'company')),
  add column first_name text check (char_length(first_name) <= 80),
  add column last_name text check (char_length(last_name) <= 80),
  add column company_name text check (char_length(company_name) <= 160),
  add column siret text check (siret ~ '^[0-9]{14}$'),
  add column privacy_accepted_at timestamptz,
  add column marketing_consent boolean not null default false,
  add column marketing_consent_at timestamptz;

comment on column public.customers.privacy_accepted_at is 'Date à laquelle le client a accepté le traitement de ses données pour établir son devis (obligatoire pour envoyer la demande).';
comment on column public.customers.marketing_consent is 'Accord facultatif pour recevoir des offres de l''entreprise (jamais exigé).';

-- -----------------------------------------------------------------------------
-- Inventaire : objets saisis par le client, volume « comparable » traçable
-- -----------------------------------------------------------------------------
alter table public.inventory_items drop constraint inventory_items_volume_source_check;
alter table public.inventory_items add constraint inventory_items_volume_source_check
  check (volume_source in ('catalog', 'dimensions', 'comparable', 'human', 'unknown'));
alter table public.inventory_items
  add column size_class text check (size_class in ('small', 'medium', 'large', 'xlarge')),
  add column customer_comment text check (char_length(customer_comment) <= 1000),
  add column volume_note text check (char_length(volume_note) <= 300);

comment on column public.inventory_items.size_class is 'Taille approximative indiquée par le client pour un objet sans volume de référence ni dimensions.';
comment on column public.inventory_items.volume_note is 'Explication du volume retenu (catalogue, dimensions × coefficient, objet de taille comparable).';

-- Objets de référence du catalogue pour les tailles approximatives (volume lu dans le catalogue, jamais inventé).
create or replace function private.size_reference(size text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case size
    when 'small' then 'carton-standard'
    when 'medium' then 'fauteuil'
    when 'large' then 'armoire-2-portes'
    when 'xlarge' then 'canape-3-places'
  end;
$$;

-- Volume unitaire d'un objet saisi par le client, avec sa justification :
-- 1. volume de déménagement du catalogue ; 2. dimensions × coefficient de manutention ;
-- 3. taille approximative → volume catalogue d'un objet comparable. Sinon : erreur (aucun volume arbitraire).
create or replace function private.customer_item_volume(catalog_id text, w numeric, d numeric, h numeric, size text,
  out unit numeric, out vmin numeric, out vmax numeric, out geometric numeric, out source text, out note text)
language plpgsql
stable
set search_path = ''
as $$
declare
  ref public.furniture_catalog;
  cmp public.furniture_catalog;
  coef numeric := 1.1;
begin
  if catalog_id is not null then
    select * into ref from public.furniture_catalog where id = catalog_id;
  end if;
  if ref.id is not null and ref.moving_volume_avg is not null then
    unit := ref.moving_volume_avg; vmin := ref.moving_volume_min; vmax := ref.moving_volume_max;
    geometric := ref.geometric_volume_avg; source := 'catalog';
    note := format('Volume de déménagement du catalogue (%s).', ref.name);
    return;
  end if;
  if w is not null and d is not null and h is not null then
    coef := case coalesce(ref.handling, 'rigide') when 'rembourre' then 1.15 when 'empilable' then 0.7 when 'demontable' then 0.45 when 'fragile' then 1.3 else 1.1 end;
    geometric := round(w * d * h / 1000000.0, 3);
    unit := least(100, round(geometric * coef, 3)); vmin := round(unit * 0.7, 3); vmax := round(unit * 1.3, 3);
    source := 'dimensions';
    note := format('Dimensions indiquées par le client (%s × %s × %s cm) × coefficient de manutention %s.', w, d, h, coef);
    return;
  end if;
  if size is not null then
    select * into cmp from public.furniture_catalog where id = private.size_reference(size);
    if cmp.id is null or cmp.moving_volume_avg is null then
      raise exception 'Reference item missing' using errcode = '22023';
    end if;
    unit := cmp.moving_volume_avg; vmin := cmp.moving_volume_min; vmax := cmp.moving_volume_max;
    geometric := null; source := 'comparable';
    note := format('Taille indiquée par le client, comparable à « %s » (volume du catalogue).', cmp.name);
    return;
  end if;
  raise exception 'Dimensions or size are required' using errcode = '22023';
end;
$$;

-- -----------------------------------------------------------------------------
-- Coordonnées v2
-- -----------------------------------------------------------------------------
create or replace function private.apply_customer_v2(req public.quote_requests, c jsonb)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  ctype text := c ->> 'type';
  first_n text := trim(coalesce(c ->> 'first_name', ''));
  last_n text := trim(coalesce(c ->> 'last_name', ''));
  mail text := lower(trim(coalesce(c ->> 'email', '')));
  tel text := trim(coalesce(c ->> 'phone', ''));
  comp text := nullif(trim(coalesce(c ->> 'company_name', '')), '');
  sir text := nullif(regexp_replace(coalesce(c ->> 'siret', ''), '\s', '', 'g'), '');
  marketing boolean := coalesce((c ->> 'marketing_consent')::boolean, false);
  cust uuid := req.customer_id;
begin
  if ctype not in ('individual', 'company') then raise exception 'Invalid customer type' using errcode = '22023'; end if;
  if char_length(first_n) not between 1 and 80 or char_length(last_n) not between 1 and 80 then
    raise exception 'First and last names are required' using errcode = '22023';
  end if;
  if mail !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or char_length(mail) > 254 then raise exception 'A valid email is required' using errcode = '22023'; end if;
  if char_length(regexp_replace(tel, '\D', '', 'g')) not between 9 and 15 or char_length(tel) > 30 then
    raise exception 'A valid phone number is required' using errcode = '22023';
  end if;
  if ctype = 'company' and (comp is null or char_length(comp) > 160) then raise exception 'Company name is required' using errcode = '22023'; end if;
  if sir is not null and sir !~ '^[0-9]{14}$' then raise exception 'Invalid SIRET' using errcode = '22023'; end if;
  if coalesce((c ->> 'privacy_accepted')::boolean, false) is not true then
    raise exception 'Privacy notice must be accepted' using errcode = '22023';
  end if;

  if cust is null then
    insert into public.customers (company_id, full_name, email, phone) values (req.company_id, left(first_n || ' ' || last_n, 120), mail, tel)
    returning id into cust;
    update public.quote_requests set customer_id = cust where id = req.id;
  end if;
  update public.customers set
    customer_type = ctype, first_name = first_n, last_name = last_n, full_name = left(first_n || ' ' || last_n, 120),
    email = mail, phone = tel,
    company_name = case when ctype = 'company' then comp else null end,
    siret = case when ctype = 'company' then sir else null end,
    privacy_accepted_at = coalesce(privacy_accepted_at, now()),
    marketing_consent_at = case when marketing and not marketing_consent then now() when not marketing then null else marketing_consent_at end,
    marketing_consent = marketing
  where id = cust and company_id = req.company_id;
  return cust;
end;
$$;

-- -----------------------------------------------------------------------------
-- Création / mise à jour du brouillon : coordonnées facultatives à la création, dates multiples, méthode
-- -----------------------------------------------------------------------------
create or replace function private.alternative_dates(payload jsonb)
returns date[]
language plpgsql
immutable
set search_path = ''
as $$
declare
  result date[];
begin
  if jsonb_typeof(payload -> 'alternative_moving_dates') <> 'array' then return null; end if;
  if jsonb_array_length(payload -> 'alternative_moving_dates') > 30 then raise exception 'Too many dates' using errcode = '22023'; end if;
  select coalesce(array_agg(distinct x::date order by x::date), '{}') into result
    from jsonb_array_elements_text(payload -> 'alternative_moving_dates') x where x <> '';
  return result;
end;
$$;

create or replace function private.insert_request_from_payload(
  target_company uuid,
  payload jsonb,
  initial_status public.request_status,
  request_source public.request_source
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  new_customer uuid;
  new_request uuid;
  kind text;
  alt date[] := private.alternative_dates(payload);
begin
  -- Coordonnées « historiques » (saisie par le déménageur, ancien parcours) : nom complet.
  if payload ? 'customer' and not ((payload -> 'customer') ? 'type') then
    insert into public.customers (company_id, full_name, email, phone)
    values (target_company, trim(payload #>> '{customer,full_name}'),
            nullif(lower(trim(payload #>> '{customer,email}')), ''), nullif(trim(payload #>> '{customer,phone}'), ''))
    returning id into new_customer;
  end if;

  insert into public.quote_requests (company_id, customer_id, status, source, moving_date, alternative_moving_date, alternative_moving_dates,
                                     moving_date_flexible, customer_notes, inventory_method, submitted_at)
  values (
    target_company, new_customer, initial_status, request_source,
    nullif(payload ->> 'moving_date', '')::date,
    coalesce(alt[1], nullif(payload ->> 'alternative_moving_date', '')::date),
    coalesce(alt, case when nullif(payload ->> 'alternative_moving_date', '') is null then '{}'::date[] else array[(payload ->> 'alternative_moving_date')::date] end),
    coalesce((payload ->> 'moving_date_flexible')::boolean, false),
    nullif(payload ->> 'customer_notes', ''),
    nullif(payload ->> 'inventory_method', ''),
    case when initial_status = 'draft' then null else now() end
  )
  returning id into new_request;

  foreach kind in array array['origin', 'destination'] loop
    if jsonb_typeof(payload -> kind) = 'object' then
      perform private.upsert_dwelling(new_request, target_company, kind::public.dwelling_kind, payload -> kind);
    end if;
  end loop;
  return new_request;
end;
$$;

create or replace function public.create_public_request(company_slug text, payload jsonb)
returns table (request_id uuid, access_token text)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  target_company uuid;
  token text;
  new_request uuid;
  v2 boolean := payload ? 'customer' and (payload -> 'customer') ? 'type';
begin
  select c.id into target_company from public.companies c where c.slug = lower(company_slug);
  if target_company is null then
    raise exception 'Unknown company' using errcode = '22023';
  end if;
  -- Ancien format (nom complet) : contrôlé comme avant. Nouveau parcours : coordonnées à l'étape 2.
  if payload ? 'customer' and not v2 then
    perform private.check_customer(payload);
  end if;
  if coalesce(trim(payload #>> '{origin,city}'), '') = '' then
    raise exception 'Origin city is required' using errcode = '22023';
  end if;
  if (select count(*) from public.quote_requests q
      where q.company_id = target_company and q.status = 'draft' and q.created_at > now() - interval '1 hour') >= 100 then
    raise exception 'Too many requests, try again later' using errcode = '54000';
  end if;

  new_request := private.insert_request_from_payload(target_company, case when v2 then payload - 'customer' else payload end, 'draft', 'customer_link');
  if v2 then
    perform private.apply_customer_v2((select q from public.quote_requests q where q.id = new_request), payload -> 'customer');
  end if;
  token := encode(extensions.gen_random_bytes(32), 'hex');
  update public.quote_requests
     set access_token_hash = private.token_hash(token),
         access_token_expires_at = now() + interval '30 days'
   where id = new_request;
  return query select new_request, token;
end;
$$;

create or replace function public.update_public_request(access_token text, payload jsonb)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  req public.quote_requests := private.request_for_token(access_token, true);
  kind text;
  alt date[] := private.alternative_dates(payload);
begin
  if payload ? 'customer' then
    if (payload -> 'customer') ? 'type' then
      perform private.apply_customer_v2(req, payload -> 'customer');
    else
      perform private.check_customer(payload);
      update public.customers c set
        full_name = trim(payload #>> '{customer,full_name}'),
        email = lower(trim(payload #>> '{customer,email}')),
        phone = nullif(trim(payload #>> '{customer,phone}'), '')
      where c.id = req.customer_id and c.company_id = req.company_id;
    end if;
  end if;

  if payload ? 'inventory_method' and coalesce(payload ->> 'inventory_method', '') not in ('video', 'manual') then
    raise exception 'Invalid inventory method' using errcode = '22023';
  end if;

  update public.quote_requests q set
    moving_date = case when payload ? 'moving_date' then nullif(payload ->> 'moving_date', '')::date else q.moving_date end,
    alternative_moving_dates = coalesce(alt, q.alternative_moving_dates),
    alternative_moving_date = case when alt is not null then alt[1]
                                   when payload ? 'alternative_moving_date' then nullif(payload ->> 'alternative_moving_date', '')::date
                                   else q.alternative_moving_date end,
    moving_date_flexible = case when payload ? 'moving_date_flexible' then coalesce((payload ->> 'moving_date_flexible')::boolean, false) else q.moving_date_flexible end,
    customer_notes = case when payload ? 'customer_notes' then nullif(payload ->> 'customer_notes', '') else q.customer_notes end,
    inventory_method = case when payload ? 'inventory_method' then payload ->> 'inventory_method' else q.inventory_method end
  where q.id = req.id;

  foreach kind in array array['origin', 'destination'] loop
    if jsonb_typeof(payload -> kind) = 'object' then
      if kind = 'origin' and (payload -> kind) ? 'city' and coalesce(trim(payload #>> '{origin,city}'), '') = '' then
        raise exception 'Origin city is required' using errcode = '22023';
      end if;
      perform private.upsert_dwelling(req.id, req.company_id, kind::public.dwelling_kind, payload -> kind);
    end if;
  end loop;
end;
$$;

-- -----------------------------------------------------------------------------
-- Brouillon complet pour le particulier (ajouts : profil, consentements, dates, méthode, inventaire)
-- -----------------------------------------------------------------------------
create or replace function public.get_public_request(access_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  req public.quote_requests := private.request_for_token(access_token, false);
begin
  return jsonb_build_object(
    'id', req.id,
    'status', req.status,
    'submitted_at', req.submitted_at,
    'moving_date', req.moving_date,
    'alternative_moving_date', req.alternative_moving_date,
    'alternative_moving_dates', to_jsonb(req.alternative_moving_dates),
    'moving_date_flexible', req.moving_date_flexible,
    'customer_notes', req.customer_notes,
    'inventory_method', req.inventory_method,
    'customer', (select jsonb_build_object('full_name', c.full_name, 'email', c.email, 'phone', c.phone, 'type', c.customer_type,
                        'first_name', c.first_name, 'last_name', c.last_name, 'company_name', c.company_name, 'siret', c.siret,
                        'privacy_accepted', c.privacy_accepted_at is not null, 'marketing_consent', c.marketing_consent)
                 from public.customers c where c.id = req.customer_id),
    'company', (select jsonb_build_object('name', c.name, 'slug', c.slug, 'logo_path', c.logo_path, 'brand_color', c.brand_color)
                from public.companies c where c.id = req.company_id),
    'dwellings', coalesce((
      select jsonb_object_agg(w.kind, jsonb_build_object(
               'address_line', w.address_line, 'postal_code', w.postal_code, 'city', w.city,
               'latitude', w.latitude, 'longitude', w.longitude, 'housing_type', w.housing_type,
               'surface_m2', w.surface_m2, 'room_count', w.room_count, 'floor', w.floor, 'elevator', w.elevator,
               'carrying_distance_m', w.carrying_distance_m, 'parking_notes', w.parking_notes, 'access_notes', w.access_notes))
      from public.dwellings w where w.request_id = req.id), '{}'::jsonb),
    'rooms', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', r.id, 'name', r.name, 'room_type', r.room_type, 'description', r.description,
               'videos', coalesce((
                 select jsonb_agg(jsonb_build_object(
                          'id', v.id, 'status', v.status, 'size_bytes', v.size_bytes, 'duration_seconds', v.duration_seconds,
                          'processing', v.processing, 'original_size_bytes', v.original_size_bytes,
                          'frames', (select count(*) from public.video_frames f where f.video_id = v.id))
                        order by v.created_at)
                 from public.room_videos v where v.room_id = r.id and v.status in ('uploaded', 'processing', 'ready')), '[]'::jsonb))
             order by r.position)
      from public.rooms r where r.request_id = req.id and coalesce(r.room_type, '') not like 'inv:%'), '[]'::jsonb),
    'item_count', (select count(*) from public.inventory_items i where i.request_id = req.id and not i.removed)
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- Inventaire modifiable par le client (jeton) : brouillon « manuel », ou inventaire de l'IA à valider
-- -----------------------------------------------------------------------------
create or replace function private.inventory_editable(req public.quote_requests)
returns void
language plpgsql
stable
set search_path = ''
as $$
begin
  if not ((req.status = 'draft' and req.inventory_method is not distinct from 'manual') or req.status = 'awaiting_customer') then
    raise exception 'Inventory cannot be changed in this state' using errcode = '55000';
  end if;
end;
$$;

-- Pièce d'une catégorie d'inventaire manuel (créée au premier objet).
create or replace function private.category_room(req public.quote_requests, category text)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  label text := case category when 'salon' then 'Salon' when 'chambres' then 'Chambres' when 'cuisine' then 'Cuisine'
    when 'salle_de_bain' then 'Salle de bain' when 'bureau' then 'Bureau' when 'garage_cave' then 'Garage et cave'
    when 'autres' then 'Autres espaces' end;
  room uuid;
begin
  if label is null then raise exception 'Unknown category' using errcode = '22023'; end if;
  select id into room from public.rooms where request_id = req.id and room_type = 'inv:' || category;
  if room is null then
    insert into public.rooms (request_id, company_id, name, room_type, position)
    values (req.id, req.company_id, label, 'inv:' || category,
            100 + array_position(array['salon', 'chambres', 'cuisine', 'salle_de_bain', 'bureau', 'garage_cave', 'autres'], category))
    returning id into room;
  end if;
  return room;
end;
$$;

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
  if size is not null and size not in ('small', 'medium', 'large', 'xlarge') then raise exception 'Invalid size' using errcode = '22023'; end if;
  if char_length(coalesce(note, '')) > 1000 then raise exception 'Comment too long' using errcode = '22023'; end if;

  if nullif(item ->> 'room_id', '') is not null then
    select id into room from public.rooms where id = (item ->> 'room_id')::uuid and request_id = req.id;
    if room is null then raise exception 'Unknown room' using errcode = '22023'; end if;
  else
    room := private.category_room(req, coalesce(item ->> 'category', 'autres'));
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

create or replace function public.public_inventory_update(token text, item_id uuid, new_quantity integer)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  req public.quote_requests := private.request_for_any_token(token);
  it public.inventory_items;
begin
  perform private.inventory_editable(req);
  if new_quantity not between 1 and 999 then raise exception 'Invalid quantity' using errcode = '22023'; end if;
  select * into it from public.inventory_items where id = item_id and request_id = req.id and not removed for update;
  if it.id is null then raise exception 'Unknown item' using errcode = '22023'; end if;
  if it.quantity = new_quantity then return; end if;
  update public.inventory_items set quantity = new_quantity where id = it.id;
  if req.status = 'awaiting_customer' then
    insert into public.inventory_item_changes (item_id, request_id, company_id, action, actor, changes, volume_before_m3, volume_after_m3)
    values (it.id, req.id, req.company_id, 'update', 'customer',
            jsonb_build_object('name', it.name, 'quantity', jsonb_build_object('avant', it.quantity, 'apres', new_quantity)),
            it.quantity * it.unit_volume_m3, new_quantity * it.unit_volume_m3);
  end if;
end;
$$;

-- Retrait par le client : l'objet est marqué retiré (jamais effacé), l'historique le trace.
create or replace function public.public_inventory_remove(token text, item_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  req public.quote_requests := private.request_for_any_token(token);
  it public.inventory_items;
begin
  perform private.inventory_editable(req);
  select * into it from public.inventory_items where id = item_id and request_id = req.id and not removed for update;
  if it.id is null then raise exception 'Unknown item' using errcode = '22023'; end if;
  update public.inventory_items set removed = true where id = it.id;
  if req.status = 'awaiting_customer' then
    insert into public.inventory_item_changes (item_id, request_id, company_id, action, actor, changes, volume_before_m3, volume_after_m3)
    values (it.id, req.id, req.company_id, 'remove', 'customer', jsonb_build_object('name', it.name), it.quantity * it.unit_volume_m3, 0);
  end if;
end;
$$;

-- Envoi d'une demande « inventaire manuel » : validation de l'inventaire par le client dans la même opération.
create or replace function public.submit_public_manual_request(access_token text, acknowledgement text)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  req public.quote_requests := private.request_for_token(access_token, true);
  view_token text := encode(extensions.gen_random_bytes(32), 'hex');
  cust public.customers;
begin
  if req.inventory_method is distinct from 'manual' then raise exception 'Manual inventory not selected' using errcode = '55000'; end if;
  select * into cust from public.customers where id = req.customer_id;
  if cust.id is null or cust.privacy_accepted_at is null then raise exception 'Contact details are required' using errcode = '22023'; end if;
  if req.moving_date is null then raise exception 'Moving date is required' using errcode = '22023'; end if;
  if exists (select 1 from public.dwellings w where w.request_id = req.id and w.floor is null) then
    raise exception 'Floors are required' using errcode = '22023';
  end if;
  if not exists (select 1 from public.inventory_items i where i.request_id = req.id and not i.removed) then
    raise exception 'Inventory is empty' using errcode = '22023';
  end if;
  if acknowledgement is null or char_length(trim(acknowledgement)) < 20 or char_length(acknowledgement) > 2000 then
    raise exception 'The warning must be acknowledged' using errcode = '22023';
  end if;
  update public.quote_requests
     set status = 'customer_validated', submitted_at = now(), view_token_hash = private.token_hash(view_token),
         access_token_expires_at = greatest(access_token_expires_at, now() + interval '90 days'),
         customer_validated_at = now(), customer_acknowledged_at = now(), customer_acknowledgement = acknowledgement,
         verification_status = 'pending'
   where id = req.id;
  return view_token;
end;
$$;

-- Envoi des vidéos : coordonnées, date et étages exigés (nouveau parcours), méthode « vidéo » enregistrée.
create or replace function public.submit_public_request(access_token text)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  req public.quote_requests := private.request_for_token(access_token, true);
  view_token text := encode(extensions.gen_random_bytes(32), 'hex');
begin
  if req.inventory_method = 'manual' then raise exception 'Manual inventory selected' using errcode = '55000'; end if;
  if not exists (select 1 from public.customers c where c.id = req.customer_id
                   and (req.inventory_method is null or c.privacy_accepted_at is not null)) then
    raise exception 'Contact details are required' using errcode = '22023';
  end if;
  if req.inventory_method is not null and (req.moving_date is null
     or exists (select 1 from public.dwellings w where w.request_id = req.id and w.floor is null)) then
    raise exception 'Moving date and floors are required' using errcode = '22023';
  end if;
  if not exists (select 1 from public.room_videos v where v.request_id = req.id and v.status = 'uploaded') then
    raise exception 'At least one video is required' using errcode = '22023';
  end if;
  update public.quote_requests
     set status = 'submitted', submitted_at = now(), view_token_hash = private.token_hash(view_token),
         access_token_expires_at = greatest(access_token_expires_at, now() + interval '90 days')
   where id = req.id;
  delete from public.room_videos where request_id = req.id and status = 'awaiting_upload';
  return view_token;
end;
$$;

-- Analyse impossible : le client complète lui-même son inventaire (il n'attend jamais le déménageur).
create or replace function public.public_resume_manual(token text)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  req public.quote_requests := private.request_for_any_token(token);
begin
  if req.status <> 'to_review' or req.source <> 'customer_link'
     or exists (select 1 from public.quotes q where q.request_id = req.id and q.status <> 'draft')
     or not exists (select 1 from public.analysis_runs a where a.request_id = req.id and a.status = 'failed')
     or exists (select 1 from public.analysis_runs a where a.request_id = req.id and a.status in ('queued', 'running')) then
    raise exception 'Cannot switch to manual inventory' using errcode = '55000';
  end if;
  update public.quote_requests set status = 'awaiting_customer' where id = req.id;
  return 'awaiting_customer';
end;
$$;

-- Inventaire lu par le client : champs utiles à la modification.
create or replace function public.get_public_inventory(token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  req public.quote_requests := private.request_for_any_token(token);
begin
  return jsonb_build_object(
    'status', req.status,
    'inventory_method', req.inventory_method,
    'customer_validated_at', req.customer_validated_at,
    'rooms', coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'name', r.name, 'category', nullif(replace(coalesce(r.room_type, ''), 'inv:', ''), r.room_type)) order by r.position)
                       from public.rooms r where r.request_id = req.id), '[]'::jsonb),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', i.id,
        'name', i.name,
        'room', coalesce(r.name, 'Autre'),
        'room_id', i.room_id,
        'room_position', coalesce(r.position, 999),
        'category', i.category,
        'catalog_key', i.catalog_key,
        'source', i.source,
        'quantity', i.quantity,
        'unit_volume_m3', i.unit_volume_m3,
        'volume_source', i.volume_source,
        'size_class', i.size_class,
        'dims', case when i.length_cm is null then null else jsonb_build_object('w', i.length_cm, 'd', i.width_cm, 'h', i.height_cm) end,
        'comment', i.customer_comment,
        'possible_duplicate', i.possible_duplicate and i.mover_duplicate_decision is null,
        'duplicate_reason', i.duplicate_reason,
        'duplicate_of', (select jsonb_build_object('id', d.id, 'name', d.name, 'room', coalesce(dr.name, 'Autre'))
                           from public.inventory_items d left join public.rooms dr on dr.id = d.room_id
                          where d.id = i.duplicate_of_item_id),
        'customer_decision', i.customer_duplicate_decision,
        'frames', coalesce((select jsonb_agg(f.storage_path order by f.captured_at_ms)
                              from (select vf.storage_path, vf.captured_at_ms from public.inventory_item_frames iif
                                      join public.video_frames vf on vf.id = iif.frame_id
                                     where iif.item_id = i.id order by vf.captured_at_ms limit 2) f), '[]'::jsonb),
        'duplicate_frames', coalesce((select jsonb_agg(f.storage_path order by f.captured_at_ms)
                              from (select vf.storage_path, vf.captured_at_ms from public.inventory_item_frames iif
                                      join public.video_frames vf on vf.id = iif.frame_id
                                     where iif.item_id = i.duplicate_of_item_id order by vf.captured_at_ms limit 2) f), '[]'::jsonb)
      ) order by coalesce(r.position, 999), i.created_at)
      from public.inventory_items i
      left join public.rooms r on r.id = i.room_id
      where i.request_id = req.id and not i.removed and i.merged_into_item_id is null
    ), '[]'::jsonb)
  );
end;
$$;

-- Catalogue proposé au client pour l'inventaire manuel (lecture publique déjà autorisée sur la table).

revoke all on function public.public_inventory_add(text, jsonb) from public;
revoke all on function public.public_inventory_update(text, uuid, integer) from public;
revoke all on function public.public_inventory_remove(text, uuid) from public;
revoke all on function public.submit_public_manual_request(text, text) from public;
revoke all on function public.public_resume_manual(text) from public;
grant execute on function public.public_inventory_add(text, jsonb) to anon, authenticated, service_role;
grant execute on function public.public_inventory_update(text, uuid, integer) to anon, authenticated, service_role;
grant execute on function public.public_inventory_remove(text, uuid) to anon, authenticated, service_role;
grant execute on function public.submit_public_manual_request(text, text) to anon, authenticated, service_role;
grant execute on function public.public_resume_manual(text) to anon, authenticated, service_role;
revoke all on function private.customer_item_volume(text, numeric, numeric, numeric, text) from public;
revoke all on function private.apply_customer_v2(public.quote_requests, jsonb) from public;
