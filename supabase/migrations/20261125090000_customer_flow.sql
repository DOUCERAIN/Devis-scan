-- =============================================================================
-- Devis Scan — phase 3 : parcours du particulier (formulaire, pièces, vidéos,
-- images extraites, brouillons abandonnés).
--
-- Complète la migration 20261124120500_public_request_flow.sql. Toutes les
-- fonctions « publiques » exigent le jeton secret du particulier ; celles qui
-- touchent au stockage sont réservées au serveur (clé secrète).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Colonnes
-- -----------------------------------------------------------------------------
alter table public.quote_requests
  add column alternative_moving_date date;
comment on column public.quote_requests.alternative_moving_date is 'Date de repli proposée par le client.';

alter table public.rooms
  add column description text check (char_length(description) <= 1000);

alter table public.room_videos
  add column capture_source text check (capture_source in ('camera', 'native_camera', 'gallery')),
  add column processing text check (processing in ('compressed', 'original')),
  add column encoder text check (char_length(encoder) <= 80),
  add column original_size_bytes bigint check (original_size_bytes >= 0),
  add column original_mime_type text check (char_length(original_mime_type) <= 100),
  add column original_width integer check (original_width > 0),
  add column original_height integer check (original_height > 0),
  add column original_duration_seconds numeric(7, 2) check (original_duration_seconds >= 0);

comment on column public.room_videos.processing is
  'compressed : vidéo réencodée dans le navigateur (≈720p, sans son) ; original : fichier d''origine envoyé tel quel (compression impossible sur l''appareil).';
comment on column public.room_videos.original_size_bytes is
  'Taille du fichier d''origine sur l''appareil du client (l''original n''est pas stocké, il reste sur le téléphone).';

-- -----------------------------------------------------------------------------
-- Insertion commune : prend en compte les nouveaux champs du logement et la date alternative
-- -----------------------------------------------------------------------------
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
begin
  insert into public.customers (company_id, full_name, email, phone)
  values (
    target_company,
    trim(payload #>> '{customer,full_name}'),
    nullif(lower(trim(payload #>> '{customer,email}')), ''),
    nullif(trim(payload #>> '{customer,phone}'), '')
  )
  returning id into new_customer;

  insert into public.quote_requests (company_id, customer_id, status, source, moving_date, alternative_moving_date,
                                     moving_date_flexible, customer_notes, submitted_at)
  values (
    target_company,
    new_customer,
    initial_status,
    request_source,
    nullif(payload ->> 'moving_date', '')::date,
    nullif(payload ->> 'alternative_moving_date', '')::date,
    coalesce((payload ->> 'moving_date_flexible')::boolean, false),
    nullif(payload ->> 'customer_notes', ''),
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

-- Crée ou complète un logement : seules les clés présentes dans `d` sont modifiées.
create or replace function private.upsert_dwelling(req_id uuid, comp_id uuid, k public.dwelling_kind, d jsonb)
returns void
language plpgsql
set search_path = ''
as $$
begin
  insert into public.dwellings (request_id, company_id, kind)
  values (req_id, comp_id, k)
  on conflict (request_id, kind) do nothing;

  update public.dwellings w set
    address_line = case when d ? 'address_line' then nullif(d ->> 'address_line', '') else w.address_line end,
    postal_code = case when d ? 'postal_code' then nullif(d ->> 'postal_code', '') else w.postal_code end,
    city = case when d ? 'city' then nullif(d ->> 'city', '') else w.city end,
    latitude = case when d ? 'latitude' then nullif(d ->> 'latitude', '')::double precision else w.latitude end,
    longitude = case when d ? 'longitude' then nullif(d ->> 'longitude', '')::double precision else w.longitude end,
    housing_type = case when d ? 'housing_type' then nullif(d ->> 'housing_type', '')::public.housing_type else w.housing_type end,
    surface_m2 = case when d ? 'surface_m2' then nullif(d ->> 'surface_m2', '')::integer else w.surface_m2 end,
    room_count = case when d ? 'room_count' then nullif(d ->> 'room_count', '')::integer else w.room_count end,
    floor = case when d ? 'floor' then nullif(d ->> 'floor', '')::integer else w.floor end,
    elevator = case when d ? 'elevator' then nullif(d ->> 'elevator', '')::public.elevator_type else w.elevator end,
    carrying_distance_m = case when d ? 'carrying_distance_m' then nullif(d ->> 'carrying_distance_m', '')::integer else w.carrying_distance_m end,
    parking_notes = case when d ? 'parking_notes' then nullif(d ->> 'parking_notes', '') else w.parking_notes end,
    access_notes = case when d ? 'access_notes' then nullif(d ->> 'access_notes', '') else w.access_notes end
  where w.request_id = req_id and w.kind = k;
end;
$$;

revoke all on function private.upsert_dwelling(uuid, uuid, public.dwelling_kind, jsonb) from public;
grant execute on function private.upsert_dwelling(uuid, uuid, public.dwelling_kind, jsonb) to authenticated, service_role;

-- Contrôles communs des coordonnées du particulier.
create or replace function private.check_customer(payload jsonb)
returns void
language plpgsql
immutable
set search_path = ''
as $$
declare
  full_name text := trim(coalesce(payload #>> '{customer,full_name}', ''));
  email text := lower(trim(coalesce(payload #>> '{customer,email}', '')));
begin
  if char_length(full_name) not between 1 and 120 then
    raise exception 'Customer name is required' using errcode = '22023';
  end if;
  if email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or char_length(email) > 254 then
    raise exception 'A valid email is required' using errcode = '22023';
  end if;
end;
$$;

-- Création : mêmes règles qu'avant, avec le contrôle commun des coordonnées.
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
begin
  select c.id into target_company from public.companies c where c.slug = lower(company_slug);
  if target_company is null then
    raise exception 'Unknown company' using errcode = '22023';
  end if;
  perform private.check_customer(payload);
  if coalesce(trim(payload #>> '{origin,city}'), '') = '' then
    raise exception 'Origin city is required' using errcode = '22023';
  end if;
  if (select count(*) from public.quote_requests q
      where q.company_id = target_company and q.status = 'draft' and q.created_at > now() - interval '1 hour') >= 100 then
    raise exception 'Too many requests, try again later' using errcode = '54000';
  end if;

  new_request := private.insert_request_from_payload(target_company, payload, 'draft', 'customer_link');
  token := encode(extensions.gen_random_bytes(32), 'hex');
  update public.quote_requests
     set access_token_hash = private.token_hash(token),
         access_token_expires_at = now() + interval '30 days'
   where id = new_request;
  return query select new_request, token;
end;
$$;

-- -----------------------------------------------------------------------------
-- Modification du brouillon (retour aux étapes précédentes)
-- -----------------------------------------------------------------------------
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
begin
  if payload ? 'customer' then
    perform private.check_customer(payload);
    update public.customers c set
      full_name = trim(payload #>> '{customer,full_name}'),
      email = lower(trim(payload #>> '{customer,email}')),
      phone = nullif(trim(payload #>> '{customer,phone}'), '')
    where c.id = req.customer_id and c.company_id = req.company_id;
  end if;

  update public.quote_requests q set
    moving_date = case when payload ? 'moving_date' then nullif(payload ->> 'moving_date', '')::date else q.moving_date end,
    alternative_moving_date = case when payload ? 'alternative_moving_date' then nullif(payload ->> 'alternative_moving_date', '')::date else q.alternative_moving_date end,
    moving_date_flexible = case when payload ? 'moving_date_flexible' then coalesce((payload ->> 'moving_date_flexible')::boolean, false) else q.moving_date_flexible end,
    customer_notes = case when payload ? 'customer_notes' then nullif(payload ->> 'customer_notes', '') else q.customer_notes end
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
-- Pièces : ajout (avec description) et modification
-- -----------------------------------------------------------------------------
drop function if exists public.add_public_room(text, text, text);

create or replace function public.add_public_room(access_token text, room_name text, room_kind text default null, room_description text default null)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  req public.quote_requests := private.request_for_token(access_token, true);
  origin_id uuid;
  room_count integer;
  new_room uuid;
begin
  if char_length(trim(coalesce(room_name, ''))) not between 1 and 80 then
    raise exception 'Room name is required' using errcode = '22023';
  end if;
  if char_length(coalesce(room_description, '')) > 1000 then
    raise exception 'Description too long' using errcode = '22023';
  end if;
  select count(*) into room_count from public.rooms where request_id = req.id;
  if room_count >= 30 then
    raise exception 'Too many rooms' using errcode = '54000';
  end if;
  select id into origin_id from public.dwellings where request_id = req.id and kind = 'origin';
  insert into public.rooms (request_id, company_id, dwelling_id, name, room_type, description, position)
  values (req.id, req.company_id, origin_id, trim(room_name), nullif(left(trim(coalesce(room_kind, '')), 40), ''),
          nullif(trim(coalesce(room_description, '')), ''),
          coalesce((select max(position) from public.rooms where request_id = req.id), 0) + 1)
  returning id into new_room;
  return new_room;
end;
$$;

create or replace function public.update_public_room(access_token text, room_id uuid, room_name text, room_kind text default null, room_description text default null)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  req public.quote_requests := private.request_for_token(access_token, true);
begin
  if char_length(trim(coalesce(room_name, ''))) not between 1 and 80 then
    raise exception 'Room name is required' using errcode = '22023';
  end if;
  if char_length(coalesce(room_description, '')) > 1000 then
    raise exception 'Description too long' using errcode = '22023';
  end if;
  update public.rooms r set
    name = trim(room_name),
    room_type = nullif(left(trim(coalesce(room_kind, '')), 40), ''),
    description = nullif(trim(coalesce(room_description, '')), '')
  where r.id = update_public_room.room_id and r.request_id = req.id;
  if not found then
    raise exception 'Unknown room' using errcode = '22023';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- Vidéos : réservation avec métadonnées, confirmation, abandon
-- -----------------------------------------------------------------------------
drop function if exists public.register_public_video(text, uuid, text, bigint);

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
  ext text;
  path text;
begin
  if not exists (select 1 from public.rooms r where r.id = register_public_video.room_id and r.request_id = req.id) then
    raise exception 'Unknown room' using errcode = '22023';
  end if;
  ext := case mime_type when 'video/mp4' then 'mp4' when 'video/webm' then 'webm' when 'video/quicktime' then 'mov' end;
  if ext is null then
    raise exception 'Unsupported video format' using errcode = '22023';
  end if;
  if size_bytes is null or size_bytes <= 0 or size_bytes > 50 * 1024 * 1024 then
    raise exception 'Video too large' using errcode = '22023';
  end if;
  -- Un seul envoi en cours par pièce : un emplacement non rempli est remplacé.
  delete from public.room_videos v where v.room_id = register_public_video.room_id and v.status = 'awaiting_upload';
  if (select count(*) from public.room_videos v
      where v.room_id = register_public_video.room_id and v.status in ('uploaded', 'processing', 'ready')) >= 3 then
    raise exception 'Too many videos for this room' using errcode = '54000';
  end if;

  path := req.company_id || '/' || req.id || '/videos/' || new_id || '.' || ext;
  insert into public.room_videos (id, request_id, company_id, room_id, storage_path, mime_type, size_bytes, status,
                                  capture_source, processing, encoder, original_size_bytes, original_mime_type,
                                  original_width, original_height, original_duration_seconds)
  values (
    new_id, req.id, req.company_id, register_public_video.room_id, path, mime_type, size_bytes, 'awaiting_upload',
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

drop function if exists public.mark_video_uploaded(text, uuid, bigint, numeric);

create or replace function public.mark_video_uploaded(access_token text, video_id uuid, actual_size bigint,
                                                      duration_seconds numeric default null, width integer default null, height integer default null)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  req public.quote_requests := private.request_for_token(access_token, true);
begin
  if actual_size is null or actual_size <= 0 or actual_size > 50 * 1024 * 1024 then
    raise exception 'Invalid size' using errcode = '22023';
  end if;
  update public.room_videos v
     set status = 'uploaded',
         size_bytes = actual_size,
         duration_seconds = case when mark_video_uploaded.duration_seconds between 0 and 99999 then round(mark_video_uploaded.duration_seconds, 2) end,
         width = case when mark_video_uploaded.width between 1 and 10000 then mark_video_uploaded.width end,
         height = case when mark_video_uploaded.height between 1 and 10000 then mark_video_uploaded.height end,
         uploaded_at = now(),
         delete_after = now() + make_interval(days => c.video_retention_days)
    from public.companies c
   where v.id = mark_video_uploaded.video_id
     and v.request_id = req.id
     and c.id = v.company_id
     and v.status = 'awaiting_upload';
  if not found then
    raise exception 'Unknown or already uploaded video' using errcode = '22023';
  end if;
end;
$$;

-- Le particulier supprime ou refait une vidéo : elle est retirée tout de suite et
-- programmée pour suppression immédiate du stockage (le serveur purge ensuite).
create or replace function public.discard_public_video(access_token text, video_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  req public.quote_requests := private.request_for_token(access_token, true);
begin
  update public.room_videos v
     set status = 'deleted', delete_after = now()
   where v.id = discard_public_video.video_id and v.request_id = req.id and v.deleted_at is null;
  if not found then
    raise exception 'Unknown video' using errcode = '22023';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- Images extraites (enregistrées par le serveur après vérification des fichiers)
-- -----------------------------------------------------------------------------
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
   where v.id = add_public_frames.video_id and v.request_id = req.id and v.status = 'uploaded';
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
-- Résumé complet du brouillon pour le particulier (reprise et récapitulatif)
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
    'moving_date_flexible', req.moving_date_flexible,
    'customer_notes', req.customer_notes,
    'customer', (select jsonb_build_object('full_name', c.full_name, 'email', c.email, 'phone', c.phone)
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
      from public.rooms r where r.request_id = req.id), '[]'::jsonb)
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- Brouillons abandonnés (jamais envoyés) : supprimés après 30 jours, fichiers compris
-- -----------------------------------------------------------------------------
create or replace function public.claim_abandoned_drafts(max_items integer default 50)
returns table (request_id uuid, file_paths text[])
language sql
stable
security definer
set search_path = ''
as $$
  select q.id,
         coalesce((select array_agg(v.storage_path) from public.room_videos v where v.request_id = q.id and v.deleted_at is null), '{}')
         || coalesce((select array_agg(f.storage_path) from public.video_frames f where f.request_id = q.id), '{}')
  from public.quote_requests q
  where q.status = 'draft'
    and q.source = 'customer_link'
    and (q.created_at < now() - interval '30 days' or q.access_token_expires_at < now())
  order by q.created_at
  limit greatest(1, least(max_items, 200));
$$;

create or replace function public.delete_abandoned_drafts(request_ids uuid[])
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  removed integer;
  orphan_customers uuid[];
begin
  select array_agg(q.customer_id) into orphan_customers
  from public.quote_requests q
  where q.id = any (request_ids) and q.status = 'draft' and q.customer_id is not null;

  delete from public.quote_requests q where q.id = any (request_ids) and q.status = 'draft';
  get diagnostics removed = row_count;

  delete from public.customers c
  where c.id = any (coalesce(orphan_customers, '{}'))
    and not exists (select 1 from public.quote_requests q where q.customer_id = c.id);
  return removed;
end;
$$;

-- -----------------------------------------------------------------------------
-- Droits d'exécution
-- -----------------------------------------------------------------------------
revoke all on function private.check_customer(jsonb) from public;
grant execute on function private.check_customer(jsonb) to authenticated, service_role;

revoke all on function public.update_public_request(text, jsonb) from public;
revoke all on function public.add_public_room(text, text, text, text) from public;
revoke all on function public.update_public_room(text, uuid, text, text, text) from public;
revoke all on function public.register_public_video(text, uuid, text, bigint, jsonb) from public;
revoke all on function public.mark_video_uploaded(text, uuid, bigint, numeric, integer, integer) from public, anon, authenticated;
revoke all on function public.discard_public_video(text, uuid) from public;
revoke all on function public.add_public_frames(text, uuid, jsonb) from public, anon, authenticated;
revoke all on function public.claim_abandoned_drafts(integer) from public, anon, authenticated;
revoke all on function public.delete_abandoned_drafts(uuid[]) from public, anon, authenticated;

grant execute on function public.update_public_request(text, jsonb) to anon, authenticated, service_role;
grant execute on function public.add_public_room(text, text, text, text) to anon, authenticated, service_role;
grant execute on function public.update_public_room(text, uuid, text, text, text) to anon, authenticated, service_role;
grant execute on function public.register_public_video(text, uuid, text, bigint, jsonb) to anon, authenticated, service_role;
grant execute on function public.discard_public_video(text, uuid) to anon, authenticated, service_role;
grant execute on function public.mark_video_uploaded(text, uuid, bigint, numeric, integer, integer) to service_role;
grant execute on function public.add_public_frames(text, uuid, jsonb) to service_role;
grant execute on function public.claim_abandoned_drafts(integer) to service_role;
grant execute on function public.delete_abandoned_drafts(uuid[]) to service_role;
