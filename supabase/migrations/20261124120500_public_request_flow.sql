-- =============================================================================
-- Devis Scan — parcours du particulier SANS COMPTE (préparation phase 3).
--
-- Le particulier n'a pas de compte : il reçoit un jeton secret (lien privé)
-- à la création de sa demande. Seul le hachage SHA-256 du jeton est stocké.
-- Toutes les opérations passent par les fonctions ci-dessous, qui vérifient
-- le jeton, l'état de la demande et des limites. Les tables restent fermées
-- aux visiteurs anonymes.
--
-- Vidéos : la fonction register_public_video réserve un emplacement ; le
-- serveur Next.js délivre ensuite une URL d'envoi signée (clé secrète) et
-- confirme l'envoi avec mark_video_uploaded (réservée au serveur).
-- Suppression RGPD : claim_videos_for_purge / mark_videos_purged (serveur).
-- =============================================================================

create extension if not exists pgcrypto with schema extensions;

-- -----------------------------------------------------------------------------
-- Insertion commune (client + demande + logements) depuis un document JSON.
-- Security invoker : appelée par create_manual_request (droits de l'utilisateur,
-- RLS appliquée) et par create_public_request (droits du propriétaire).
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
  d jsonb;
begin
  insert into public.customers (company_id, full_name, email, phone)
  values (
    target_company,
    trim(payload #>> '{customer,full_name}'),
    nullif(lower(trim(payload #>> '{customer,email}')), ''),
    nullif(trim(payload #>> '{customer,phone}'), '')
  )
  returning id into new_customer;

  insert into public.quote_requests (company_id, customer_id, status, source, moving_date, moving_date_flexible,
                                     customer_notes, submitted_at)
  values (
    target_company,
    new_customer,
    initial_status,
    request_source,
    nullif(payload ->> 'moving_date', '')::date,
    coalesce((payload ->> 'moving_date_flexible')::boolean, false),
    nullif(payload ->> 'customer_notes', ''),
    case when initial_status = 'draft' then null else now() end
  )
  returning id into new_request;

  foreach kind in array array['origin', 'destination'] loop
    d := payload -> kind;
    if d is not null and jsonb_typeof(d) = 'object' then
      insert into public.dwellings (request_id, company_id, kind, address_line, postal_code, city, housing_type,
                                    floor, elevator, carrying_distance_m, access_notes)
      values (
        new_request,
        target_company,
        kind::public.dwelling_kind,
        nullif(d ->> 'address_line', ''),
        nullif(d ->> 'postal_code', ''),
        nullif(d ->> 'city', ''),
        nullif(d ->> 'housing_type', '')::public.housing_type,
        nullif(d ->> 'floor', '')::integer,
        nullif(d ->> 'elevator', '')::public.elevator_type,
        nullif(d ->> 'carrying_distance_m', '')::integer,
        nullif(d ->> 'access_notes', '')
      );
    end if;
  end loop;

  return new_request;
end;
$$;

revoke all on function private.insert_request_from_payload(uuid, jsonb, public.request_status, public.request_source) from public;
grant execute on function private.insert_request_from_payload(uuid, jsonb, public.request_status, public.request_source) to authenticated, service_role;

-- La saisie manuelle réutilise désormais l'insertion commune.
create or replace function public.create_manual_request(payload jsonb)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  target_company uuid;
begin
  if uid is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  select company_id into target_company from public.company_members where user_id = uid order by created_at limit 1;
  if target_company is null then
    raise exception 'User has no company' using errcode = '42501';
  end if;
  return private.insert_request_from_payload(target_company, payload, 'submitted', 'mover_manual');
end;
$$;

-- -----------------------------------------------------------------------------
-- Jetons d'accès du particulier
-- -----------------------------------------------------------------------------
create or replace function private.token_hash(token text)
returns text
language sql
immutable
set search_path = ''
as $$
  select encode(extensions.digest(coalesce(token, ''), 'sha256'), 'hex');
$$;

-- Demande correspondant à un jeton valide ; erreur si lien invalide, expiré ou déjà envoyé.
create or replace function private.request_for_token(token text, require_draft boolean)
returns public.quote_requests
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  found public.quote_requests;
begin
  if token is null or token !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid link' using errcode = '42501';
  end if;
  select * into found
  from public.quote_requests
  where access_token_hash = private.token_hash(token)
    and access_token_expires_at > now();
  if found.id is null then
    raise exception 'Invalid or expired link' using errcode = '42501';
  end if;
  if require_draft and found.status <> 'draft' then
    raise exception 'Request already submitted' using errcode = '55000';
  end if;
  return found;
end;
$$;

revoke all on function private.request_for_token(text, boolean) from public;

-- -----------------------------------------------------------------------------
-- Informations publiques d'une entreprise (page de demande à ses couleurs)
-- -----------------------------------------------------------------------------
create or replace function public.get_public_company(company_slug text)
returns table (id uuid, name text, slug text, logo_path text, brand_color text, phone text, email text, website text)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id, c.name, c.slug, c.logo_path, c.brand_color, c.phone, c.email, c.website
  from public.companies c
  where c.slug = lower(company_slug);
$$;

-- -----------------------------------------------------------------------------
-- Création d'une demande par un particulier (brouillon + jeton secret)
-- -----------------------------------------------------------------------------
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
  full_name text := trim(coalesce(payload #>> '{customer,full_name}', ''));
  email text := lower(trim(coalesce(payload #>> '{customer,email}', '')));
begin
  select c.id into target_company from public.companies c where c.slug = lower(company_slug);
  if target_company is null then
    raise exception 'Unknown company' using errcode = '22023';
  end if;
  if char_length(full_name) not between 1 and 120 then
    raise exception 'Customer name is required' using errcode = '22023';
  end if;
  if email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or char_length(email) > 254 then
    raise exception 'A valid email is required' using errcode = '22023';
  end if;
  if coalesce(trim(payload #>> '{origin,city}'), '') = '' then
    raise exception 'Origin city is required' using errcode = '22023';
  end if;
  -- Garde-fou contre les créations en masse.
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
-- Pièces de la demande
-- -----------------------------------------------------------------------------
create or replace function public.add_public_room(access_token text, room_name text, room_kind text default null)
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
  select count(*) into room_count from public.rooms where request_id = req.id;
  if room_count >= 30 then
    raise exception 'Too many rooms' using errcode = '54000';
  end if;
  select id into origin_id from public.dwellings where request_id = req.id and kind = 'origin';
  insert into public.rooms (request_id, company_id, dwelling_id, name, room_type, position)
  values (req.id, req.company_id, origin_id, trim(room_name), nullif(left(trim(coalesce(room_kind, '')), 40), ''), room_count + 1)
  returning id into new_room;
  return new_room;
end;
$$;

create or replace function public.remove_public_room(access_token text, room_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  req public.quote_requests := private.request_for_token(access_token, true);
begin
  -- D'abord vérifier que la pièce appartient à cette demande (ne rien révéler des autres).
  if not exists (select 1 from public.rooms r where r.id = remove_public_room.room_id and r.request_id = req.id) then
    raise exception 'Unknown room' using errcode = '22023';
  end if;
  if exists (select 1 from public.room_videos v where v.room_id = remove_public_room.room_id and v.status <> 'deleted') then
    raise exception 'Room has videos' using errcode = '55000';
  end if;
  delete from public.rooms r where r.id = remove_public_room.room_id and r.request_id = req.id;
end;
$$;

-- -----------------------------------------------------------------------------
-- Vidéos : réservation d'un emplacement (l'envoi se fait par URL signée)
-- -----------------------------------------------------------------------------
create or replace function public.register_public_video(access_token text, room_id uuid, mime_type text, size_bytes bigint)
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
  if (select count(*) from public.room_videos v where v.room_id = register_public_video.room_id and v.status <> 'deleted') >= 3 then
    raise exception 'Too many videos for this room' using errcode = '54000';
  end if;

  path := req.company_id || '/' || req.id || '/videos/' || new_id || '.' || ext;
  insert into public.room_videos (id, request_id, company_id, room_id, storage_path, mime_type, size_bytes, status)
  values (new_id, req.id, req.company_id, register_public_video.room_id, path, mime_type, size_bytes, 'awaiting_upload');
  return query select new_id, path;
end;
$$;

-- Confirmation par le serveur, après vérification que le fichier est bien dans le stockage.
-- Le jeton du particulier est exigé : on ne confirme que les vidéos de SA demande.
create or replace function public.mark_video_uploaded(access_token text, video_id uuid, actual_size bigint, duration_seconds numeric default null)
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
     set status = 'uploaded',
         size_bytes = actual_size,
         duration_seconds = mark_video_uploaded.duration_seconds,
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

-- -----------------------------------------------------------------------------
-- Résumé de la demande pour le particulier (reprise du parcours)
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
    'company', (select jsonb_build_object('name', c.name, 'slug', c.slug, 'logo_path', c.logo_path, 'brand_color', c.brand_color)
                from public.companies c where c.id = req.company_id),
    'rooms', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', r.id, 'name', r.name, 'room_type', r.room_type,
               'videos', (select count(*) from public.room_videos v where v.room_id = r.id and v.status in ('uploaded', 'processing', 'ready')))
             order by r.position)
      from public.rooms r where r.request_id = req.id), '[]'::jsonb)
  );
end;
$$;

-- Envoi définitif de la demande au déménageur.
create or replace function public.submit_public_request(access_token text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  req public.quote_requests := private.request_for_token(access_token, true);
begin
  if not exists (select 1 from public.room_videos v where v.request_id = req.id and v.status = 'uploaded') then
    raise exception 'At least one video is required' using errcode = '22023';
  end if;
  update public.quote_requests set status = 'submitted', submitted_at = now() where id = req.id;
  -- Les emplacements jamais remplis sont abandonnés.
  delete from public.room_videos where request_id = req.id and status = 'awaiting_upload';
end;
$$;

-- -----------------------------------------------------------------------------
-- Purge RGPD : vidéos arrivées à échéance (appelée par la tâche planifiée serveur)
-- -----------------------------------------------------------------------------
create or replace function public.claim_videos_for_purge(max_items integer default 100)
returns table (video_id uuid, storage_path text, frame_paths text[])
language sql
stable
security definer
set search_path = ''
as $$
  select v.id, v.storage_path,
         coalesce((select array_agg(f.storage_path) from public.video_frames f where f.video_id = v.id), '{}')
  from public.room_videos v
  where v.deleted_at is null and v.delete_after is not null and v.delete_after <= now()
  order by v.delete_after
  limit greatest(1, least(max_items, 500));
$$;

create or replace function public.mark_videos_purged(video_ids uuid[])
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  affected integer;
begin
  delete from public.video_frames where video_id = any (video_ids);
  update public.room_videos
     set status = 'deleted', deleted_at = now()
   where id = any (video_ids) and deleted_at is null;
  get diagnostics affected = row_count;
  return affected;
end;
$$;

-- -----------------------------------------------------------------------------
-- Droits d'exécution
-- -----------------------------------------------------------------------------
revoke all on function public.get_public_company(text) from public;
revoke all on function public.create_public_request(text, jsonb) from public;
revoke all on function public.add_public_room(text, text, text) from public;
revoke all on function public.remove_public_room(text, uuid) from public;
revoke all on function public.register_public_video(text, uuid, text, bigint) from public;
revoke all on function public.get_public_request(text) from public;
revoke all on function public.submit_public_request(text) from public;
revoke all on function public.mark_video_uploaded(text, uuid, bigint, numeric) from public, anon, authenticated;
revoke all on function public.claim_videos_for_purge(integer) from public, anon, authenticated;
revoke all on function public.mark_videos_purged(uuid[]) from public, anon, authenticated;

grant execute on function public.get_public_company(text) to anon, authenticated, service_role;
grant execute on function public.create_public_request(text, jsonb) to anon, authenticated, service_role;
grant execute on function public.add_public_room(text, text, text) to anon, authenticated, service_role;
grant execute on function public.remove_public_room(text, uuid) to anon, authenticated, service_role;
grant execute on function public.register_public_video(text, uuid, text, bigint) to anon, authenticated, service_role;
grant execute on function public.get_public_request(text) to anon, authenticated, service_role;
grant execute on function public.submit_public_request(text) to anon, authenticated, service_role;
grant execute on function public.mark_video_uploaded(text, uuid, bigint, numeric) to service_role;
grant execute on function public.claim_videos_for_purge(integer) to service_role;
grant execute on function public.mark_videos_purged(uuid[]) to service_role;
