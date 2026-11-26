-- =============================================================================
-- Devis Scan — parcours client v3 (02/12/2026)
--   1. Médias du logement sans pièce imposée : vidéos multiples et PHOTOS, rattachées à une pièce technique
--      « Mon logement » (room_type = 'logement') créée automatiquement.
--   2. Inventaire visuel : pièce « Entrée / couloir », pièces supplémentaires (Chambre 2…), étape des cartons
--      supplémentaires (obligatoire, zéro accepté) sans double comptage avec les cartons repérés par l'IA.
--   3. Devis côté client : les montants ligne à ligne (prix des options et suppléments) ne sont plus transmis
--      au client ; il reçoit les prestations, leur description et les totaux. Le déménageur garde tout.
-- Aucun tarif, aucun volume du catalogue ni aucune règle de calcul n'est modifié. Aucune donnée supprimée.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Photos : une photo est un média (room_videos.media_kind = 'photo') dont le fichier JPEG sert aussi
--    d'image d'analyse (video_frames, même chemin). Les règles de conservation et de purge sont inchangées.
-- -----------------------------------------------------------------------------
alter table public.room_videos
  add column media_kind text not null default 'video' check (media_kind in ('video', 'photo'));
alter table public.room_videos drop constraint room_videos_mime_type_check;
alter table public.room_videos add constraint room_videos_mime_type_check
  check (mime_type in ('video/mp4', 'video/webm', 'video/quicktime', 'image/jpeg'));
alter table public.room_videos add constraint room_videos_media_kind_mime_check
  check ((media_kind = 'photo') = (mime_type = 'image/jpeg'));
comment on column public.room_videos.media_kind is
  'video : vidéo filmée ou importée (images extraites à part) ; photo : photo importée, convertie en JPEG dans le navigateur, analysée telle quelle.';

-- Cartons supplémentaires déclarés par le client (null = étape non encore remplie ; 0 accepté).
alter table public.quote_requests
  add column extra_boxes integer check (extra_boxes between 0 and 999);
comment on column public.quote_requests.extra_boxes is
  'Nombre de cartons SUPPLÉMENTAIRES indiqué par le client, en plus des cartons repérés par l''analyse. Reporté dans l''inventaire (objet « Carton standard », pièce « Cartons »).';

-- -----------------------------------------------------------------------------
-- Pièce technique des médias du logement (aucune saisie de pièce demandée au client)
-- -----------------------------------------------------------------------------
create or replace function public.public_media_room(access_token text)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  req public.quote_requests := private.request_for_token(access_token, true);
  room uuid;
begin
  select id into room from public.rooms where request_id = req.id and room_type = 'logement' order by position limit 1;
  if room is null then
    insert into public.rooms (request_id, company_id, dwelling_id, name, room_type, position)
    values (req.id, req.company_id, (select id from public.dwellings where request_id = req.id and kind = 'origin'),
            'Mon logement', 'logement', 0)
    returning id into room;
  end if;
  return room;
end;
$$;

-- Réservation d'un média : vidéo (50 Mo, 3 par pièce, 20 pour « Mon logement ») ou photo JPEG
-- (10 Mo, 80 par demande). Un emplacement non rempli du même type est remplacé.
drop function if exists public.register_public_video(text, uuid, text, bigint, jsonb);

create or replace function public.register_public_video(access_token text, room_id uuid, mime_type text, size_bytes bigint, meta jsonb default '{}'::jsonb)
returns table (video_id uuid, storage_path text)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  req public.quote_requests := private.request_for_token(access_token, true);
  new_id uuid := gen_random_uuid();
  kind text := case when meta ->> 'media_kind' = 'photo' then 'photo' else 'video' end;
  room public.rooms;
  ext text;
  path text;
  max_videos integer := 3;
begin
  select * into room from public.rooms r where r.id = register_public_video.room_id and r.request_id = req.id;
  if room.id is null then
    raise exception 'Unknown room' using errcode = '22023';
  end if;
  if kind = 'photo' then
    if mime_type <> 'image/jpeg' then raise exception 'Unsupported photo format' using errcode = '22023'; end if;
    if size_bytes is null or size_bytes <= 0 or size_bytes > 10 * 1024 * 1024 then
      raise exception 'Photo too large' using errcode = '22023';
    end if;
    if (select count(*) from public.room_videos v
         where v.request_id = req.id and v.media_kind = 'photo' and v.status in ('uploaded', 'processing', 'ready')) >= 80 then
      raise exception 'Too many photos' using errcode = '54000';
    end if;
    ext := 'jpg';
    path := req.company_id || '/' || req.id || '/photos/' || new_id || '.jpg';
  else
    ext := case mime_type when 'video/mp4' then 'mp4' when 'video/webm' then 'webm' when 'video/quicktime' then 'mov' end;
    if ext is null then
      raise exception 'Unsupported video format' using errcode = '22023';
    end if;
    if size_bytes is null or size_bytes <= 0 or size_bytes > 50 * 1024 * 1024 then
      raise exception 'Video too large' using errcode = '22023';
    end if;
    -- Pièces filmées une à une (ancien parcours) : un seul envoi en cours par pièce.
    if room.room_type is distinct from 'logement' then
      delete from public.room_videos v where v.room_id = register_public_video.room_id and v.status = 'awaiting_upload' and v.media_kind = 'video';
    else
      max_videos := 20;
    end if;
    if (select count(*) from public.room_videos v
        where v.room_id = register_public_video.room_id and v.media_kind = 'video' and v.status in ('uploaded', 'processing', 'ready')) >= max_videos then
      raise exception 'Too many videos for this room' using errcode = '54000';
    end if;
    path := req.company_id || '/' || req.id || '/videos/' || new_id || '.' || ext;
  end if;

  insert into public.room_videos (id, request_id, company_id, room_id, storage_path, mime_type, size_bytes, status, media_kind,
                                  capture_source, processing, encoder, original_size_bytes, original_mime_type,
                                  original_width, original_height, original_duration_seconds)
  values (
    new_id, req.id, req.company_id, register_public_video.room_id, path, mime_type, size_bytes, 'awaiting_upload', kind,
    case when meta ->> 'capture_source' in ('camera', 'native_camera', 'gallery') then meta ->> 'capture_source' end,
    case when meta ->> 'processing' in ('compressed', 'original') then meta ->> 'processing' end,
    left(nullif(meta ->> 'encoder', ''), 80),
    case when (meta ->> 'original_size_bytes') ~ '^[0-9]{1,12}$' then (meta ->> 'original_size_bytes')::bigint end,
    left(nullif(meta ->> 'original_mime_type', ''), 100),
    case when (meta ->> 'original_width') ~ '^[1-9][0-9]{0,4}$' then (meta ->> 'original_width')::integer end,
    case when (meta ->> 'original_height') ~ '^[1-9][0-9]{0,4}$' then (meta ->> 'original_height')::integer end,
    case when (meta ->> 'original_duration_seconds') ~ '^[0-9]{1,5}(\.[0-9]+)?$' then round((meta ->> 'original_duration_seconds')::numeric, 2) end
  );
  return query select new_id, path;
end;
$$;

-- Une photo envoyée et vérifiée par le serveur devient sa propre image d'analyse (même fichier).
create or replace function public.add_public_photo_frame(access_token text, video_id uuid, width integer default null, height integer default null)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  req public.quote_requests := private.request_for_token(access_token, true);
  vid public.room_videos;
begin
  select * into vid from public.room_videos v
   where v.id = add_public_photo_frame.video_id and v.request_id = req.id and v.status = 'uploaded' and v.media_kind = 'photo';
  if vid.id is null then
    raise exception 'Unknown photo' using errcode = '22023';
  end if;
  if exists (select 1 from public.video_frames f where f.video_id = vid.id) then return; end if;
  insert into public.video_frames (request_id, company_id, video_id, storage_path, captured_at_ms, width, height)
  values (req.id, req.company_id, vid.id, vid.storage_path, 0,
          case when add_public_photo_frame.width between 1 and 10000 then add_public_photo_frame.width end,
          case when add_public_photo_frame.height between 1 and 10000 then add_public_photo_frame.height end);
end;
$$;

-- Images extraites d'une VIDÉO (inchangé, sauf refus des photos qui ont leur propre fonction).
create or replace function public.add_public_frames(access_token text, video_id uuid, frames jsonb)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  req public.quote_requests := private.request_for_token(access_token, true);
  vid public.room_videos;
  prefix text;
  f jsonb;
  inserted integer := 0;
begin
  select * into vid from public.room_videos v
   where v.id = add_public_frames.video_id and v.request_id = req.id and v.status = 'uploaded' and v.media_kind = 'video';
  if vid.id is null then
    raise exception 'Unknown video' using errcode = '22023';
  end if;
  if jsonb_typeof(frames) <> 'array' or jsonb_array_length(frames) = 0 then
    raise exception 'No frames' using errcode = '22023';
  end if;
  if (select count(*) from public.video_frames x where x.video_id = vid.id) + jsonb_array_length(frames) > 12 then
    raise exception 'Too many frames' using errcode = '54000';
  end if;
  prefix := req.company_id || '/' || req.id || '/frames/' || vid.id || '/';
  for f in select * from jsonb_array_elements(frames) loop
    if left(f ->> 'path', char_length(prefix)) <> prefix
       or substr(f ->> 'path', char_length(prefix) + 1) !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$' then
      raise exception 'Invalid frame path' using errcode = '22023';
    end if;
    insert into public.video_frames (request_id, company_id, video_id, storage_path, captured_at_ms, width, height)
    values (
      req.id, req.company_id, vid.id, f ->> 'path',
      case when (f ->> 'captured_at_ms') ~ '^[0-9]{1,9}$' then (f ->> 'captured_at_ms')::integer end,
      case when (f ->> 'width') ~ '^[1-9][0-9]{0,4}$' then (f ->> 'width')::integer end,
      case when (f ->> 'height') ~ '^[1-9][0-9]{0,4}$' then (f ->> 'height')::integer end
    );
    inserted := inserted + 1;
  end loop;
  return inserted;
end;
$$;

-- -----------------------------------------------------------------------------
-- Brouillon lu par le client : type de média et cartons supplémentaires en plus
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
    'extra_boxes', req.extra_boxes,
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
                          'id', v.id, 'kind', v.media_kind, 'status', v.status, 'size_bytes', v.size_bytes, 'duration_seconds', v.duration_seconds,
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
-- 2. Pièces de l'inventaire : « Entrée / couloir », « Cartons » (étape dédiée) et pièces supplémentaires
-- -----------------------------------------------------------------------------
create or replace function private.category_room(req public.quote_requests, category text)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  label text := case category when 'salon' then 'Salon' when 'chambres' then 'Chambre' when 'cuisine' then 'Cuisine'
    when 'salle_de_bain' then 'Salle de bain' when 'bureau' then 'Bureau' when 'entree' then 'Entrée / couloir'
    when 'garage_cave' then 'Garage / cave' when 'autres' then 'Autre pièce' when 'cartons' then 'Cartons' end;
  room uuid;
begin
  if label is null then raise exception 'Unknown category' using errcode = '22023'; end if;
  select id into room from public.rooms where request_id = req.id and room_type = 'inv:' || category;
  if room is null then
    insert into public.rooms (request_id, company_id, name, room_type, position)
    values (req.id, req.company_id, label, 'inv:' || category,
            100 + array_position(array['cartons', 'salon', 'cuisine', 'chambres', 'salle_de_bain', 'bureau', 'entree', 'garage_cave', 'autres'], category))
    returning id into room;
  end if;
  return room;
end;
$$;

-- Pièce supplémentaire (Chambre 2, buanderie…) : room_type = 'inv:<catégorie>:<n>'.
create or replace function public.public_inventory_add_room(token text, base_category text, room_name text)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  req public.quote_requests := private.request_for_any_token(token);
  n integer;
  room uuid;
begin
  perform private.inventory_editable(req);
  if base_category is null or base_category not in ('salon', 'chambres', 'cuisine', 'salle_de_bain', 'bureau', 'entree', 'garage_cave', 'autres') then
    raise exception 'Unknown category' using errcode = '22023';
  end if;
  if char_length(trim(coalesce(room_name, ''))) not between 1 and 80 then
    raise exception 'Room name is required' using errcode = '22023';
  end if;
  if (select count(*) from public.rooms where request_id = req.id) >= 40 then
    raise exception 'Too many rooms' using errcode = '54000';
  end if;
  select coalesce(max(nullif(split_part(room_type, ':', 3), '')::integer), 1) + 1 into n
    from public.rooms where request_id = req.id and room_type like 'inv:' || base_category || ':%';
  insert into public.rooms (request_id, company_id, name, room_type, position)
  values (req.id, req.company_id, trim(room_name), 'inv:' || base_category || ':' || n,
          200 + (select count(*) from public.rooms where request_id = req.id))
  returning id into room;
  return room;
end;
$$;

-- Étape « cartons » : nombre de cartons SUPPLÉMENTAIRES (0 accepté), reporté dans l'inventaire.
create or replace function public.public_set_extra_boxes(token text, boxes integer)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  req public.quote_requests := private.request_for_any_token(token);
  room uuid;
  it public.inventory_items;
begin
  perform private.inventory_editable(req);
  if boxes is null or boxes not between 0 and 999 then raise exception 'Invalid quantity' using errcode = '22023'; end if;
  update public.quote_requests set extra_boxes = boxes where id = req.id;
  room := private.category_room(req, 'cartons');
  select * into it from public.inventory_items
   where request_id = req.id and room_id = room and catalog_key = 'carton-standard' and source = 'customer' and not removed
   order by created_at limit 1;
  if boxes = 0 then
    if it.id is not null then perform public.public_inventory_remove(token, it.id); end if;
  elsif it.id is null then
    perform public.public_inventory_add(token, jsonb_build_object('catalog_key', 'carton-standard', 'room_id', room, 'category', 'cartons', 'quantity', boxes));
  else
    perform public.public_inventory_update(token, it.id, boxes);
  end if;
end;
$$;

-- Inventaire lu par le client : cartons supplémentaires en plus.
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
    'extra_boxes', req.extra_boxes,
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

-- Envoi « inventaire manuel » : l'étape des cartons doit avoir été remplie (0 accepté).
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
  if req.extra_boxes is null then raise exception 'The number of boxes is required' using errcode = '22023'; end if;
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

-- Validation de l'inventaire de l'analyse : l'étape des cartons doit avoir été remplie (0 accepté).
create or replace function public.validate_public_inventory(token text, decisions jsonb, acknowledgement text)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  req public.quote_requests := private.request_for_any_token(token);
  item record;
  decision text;
  unit_volume numeric;
begin
  if req.status <> 'awaiting_customer' then
    raise exception 'Inventory cannot be validated in this state' using errcode = '55000';
  end if;
  if req.extra_boxes is null then
    raise exception 'The number of boxes is required' using errcode = '22023';
  end if;
  if not exists (select 1 from public.inventory_items i where i.request_id = req.id and not i.removed and i.merged_into_item_id is null) then
    raise exception 'Inventory is empty' using errcode = '22023';
  end if;
  if acknowledgement is null or char_length(trim(acknowledgement)) < 20 or char_length(acknowledgement) > 2000 then
    raise exception 'The warning must be acknowledged' using errcode = '22023';
  end if;
  if decisions is null or jsonb_typeof(decisions) <> 'object' then
    raise exception 'Invalid decisions' using errcode = '22023';
  end if;
  if exists (select 1 from jsonb_object_keys(decisions) k
              where not exists (select 1 from public.inventory_items i
                                 where i.id::text = k and i.request_id = req.id and i.possible_duplicate
                                   and not i.removed and i.mover_duplicate_decision is null)) then
    raise exception 'Unknown item' using errcode = '22023';
  end if;
  for item in
    select i.id, i.name, i.quantity, i.unit_volume_m3 from public.inventory_items i
     where i.request_id = req.id and i.possible_duplicate and not i.removed
       and i.mover_duplicate_decision is null and i.merged_into_item_id is null
     for update
  loop
    decision := decisions ->> item.id::text;
    if decision is null or decision not in ('distinct', 'same') then
      raise exception 'Every item to check must be answered' using errcode = '22023';
    end if;
    update public.inventory_items set customer_duplicate_decision = decision, customer_decided_at = now() where id = item.id;
    unit_volume := item.quantity * item.unit_volume_m3;
    insert into public.inventory_item_changes (item_id, request_id, company_id, action, actor, changes, volume_before_m3, volume_after_m3)
    values (item.id, req.id, req.company_id, 'customer_decision', 'customer',
            jsonb_build_object('name', item.name, 'decision', decision),
            unit_volume, case when decision = 'same' then 0 else unit_volume end);
  end loop;
  update public.quote_requests
     set status = 'customer_validated', customer_validated_at = now(), customer_acknowledged_at = now(),
         customer_acknowledgement = acknowledgement, verification_status = 'pending'
   where id = req.id;
  return 'validated';
end;
$$;

-- -----------------------------------------------------------------------------
-- 3. Devis côté client : prestations et totaux, sans montant ni prix unitaire par ligne
-- -----------------------------------------------------------------------------
-- Description d'une ligne de devis sans aucun prix (les détails calculés par le moteur citent des prix).
create or replace function private.client_line(line jsonb)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select jsonb_build_object(
    'code', line ->> 'code',
    'label', line ->> 'label',
    'detail', case line ->> 'code'
      when 'volume' then replace(trim(to_char((line ->> 'quantity')::numeric, 'FM999990.0')), '.', ',') || ' m³'
      when 'option' then case line ->> 'unit'
        when 'm³' then 'Selon le volume'
        when 'unité' then (line ->> 'quantity') || ' × ' || 'unité'
        else 'Forfait' end
      when 'minimum' then 'Forfait minimum de l''entreprise'
      when 'travel' then 'Forfait'
      else coalesce(line ->> 'detail', '')
    end
  );
$$;

create or replace function public.get_public_quote_view(token text)
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
    'submitted_at', req.submitted_at,
    'customer_validated_at', req.customer_validated_at,
    'analysis', (select jsonb_build_object('status', a.status, 'stage', a.stage, 'rooms_total', a.rooms_total,
                                           'rooms_done', a.rooms_done, 'simulated', a.simulated, 'error_code', a.error_code)
                 from public.analysis_runs a where a.request_id = req.id order by a.created_at desc limit 1),
    'corrections', coalesce((select jsonb_agg(jsonb_build_object(
                 'outcome', v.outcome, 'reason', v.reason, 'changes', v.changes, 'created_at', v.created_at,
                 'volume_before_m3', v.volume_before_m3, 'volume_after_m3', v.volume_after_m3,
                 'total_before_cents', v.total_before_cents, 'total_after_cents', v.total_after_cents) order by v.created_at desc)
               from public.inventory_verifications v where v.request_id = req.id and v.outcome <> 'confirmed'), '[]'::jsonb),
    'quotes', coalesce((select jsonb_agg(jsonb_build_object(
                 'id', q.id, 'version', q.version, 'status', q.status, 'kind', q.kind, 'origin', q.origin, 'created_at', q.created_at,
                 'valid_until', q.valid_until,
                 'lines', coalesce((select jsonb_agg(private.client_line(l) order by n) from jsonb_array_elements(q.lines) with ordinality as x(l, n)), '[]'::jsonb),
                 'prices_hidden', true,
                 'total_ht_cents', q.total_ht_cents, 'vat_cents', q.vat_cents,
                 'total_ttc_cents', q.total_ttc_cents, 'vat_rate', q.vat_rate, 'distance_km', q.distance_km,
                 'distance_method', q.distance_method,
                 -- Fourchette haute « avec les objets incertains » : un total, jamais un prix par ligne.
                 'volume', q.volume_snapshot, 'company', q.company_snapshot,
                 'request', q.request_snapshot, 'inventory', q.inventory_snapshot, 'assumptions', q.assumptions,
                 'review_reasons', q.review_reasons,
                 -- Écarts entre versions : seuls les totaux et le volume facturé (jamais l'écart d'une ligne précise).
                 'changes', case when jsonb_typeof(q.changes_summary -> 'differences') = 'array' then
                     jsonb_set(q.changes_summary, '{differences}', coalesce((select jsonb_agg(d) from jsonb_array_elements(q.changes_summary -> 'differences') d
                                                                           where d #>> '{}' ~ '^(Montant|Volume factur)'), '[]'::jsonb))
                   else q.changes_summary end,
                 'sent_at', q.sent_at, 'accepted_at', q.accepted_at,
                 'refused_at', q.refused_at, 'amends_quote_id', q.amends_quote_id, 'supersedes_id', q.supersedes_id)
               order by q.version desc)
               from public.quotes q where q.request_id = req.id and q.status <> 'draft'), '[]'::jsonb)
  );
end;
$$;

-- Options proposées au client : nom, description et mode (pour demander une quantité), sans le prix.
drop function if exists public.get_public_company_options(text);
create or replace function public.get_public_company_options(company_slug text)
returns table (id uuid, name text, description text, pricing_mode public.pricing_mode)
language sql
stable
security definer
set search_path = ''
as $$
  select o.id, o.name, o.description, o.pricing_mode
  from public.pricing_options o
  join public.companies c on c.id = o.company_id
  where c.slug = lower(company_slug) and o.is_active
  order by o.position, o.created_at;
$$;

-- -----------------------------------------------------------------------------
-- Droits
-- -----------------------------------------------------------------------------
revoke all on function public.public_media_room(text) from public;
revoke all on function public.register_public_video(text, uuid, text, bigint, jsonb) from public;
revoke all on function public.add_public_photo_frame(text, uuid, integer, integer) from public, anon, authenticated;
revoke all on function public.public_inventory_add_room(text, text, text) from public;
revoke all on function public.public_set_extra_boxes(text, integer) from public;
revoke all on function public.get_public_company_options(text) from public;
revoke all on function private.client_line(jsonb) from public;
grant execute on function public.public_media_room(text) to anon, authenticated, service_role;
grant execute on function public.register_public_video(text, uuid, text, bigint, jsonb) to anon, authenticated, service_role;
grant execute on function public.add_public_photo_frame(text, uuid, integer, integer) to service_role;
grant execute on function public.public_inventory_add_room(text, text, text) to anon, authenticated, service_role;
grant execute on function public.public_set_extra_boxes(text, integer) to anon, authenticated, service_role;
grant execute on function public.get_public_company_options(text) to anon, authenticated, service_role;
