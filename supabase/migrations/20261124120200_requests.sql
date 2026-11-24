-- =============================================================================
-- Devis Scan — demandes de devis, logements, pièces, vidéos, images,
-- analyses IA, inventaire, devis et historique.
--
-- Cohérence multi-entreprises : chaque table enfant référence la demande par
-- la paire (request_id, company_id). Une ligne ne peut donc jamais pointer
-- vers une demande d'une autre entreprise.
-- =============================================================================

create type public.request_status as enum (
  'draft',        -- le client remplit sa demande
  'submitted',    -- demande envoyée, en attente d'analyse
  'analyzing',    -- analyse IA en cours
  'to_review',    -- inventaire prêt, vérification par le déménageur
  'quote_sent',   -- devis envoyé au client
  'accepted',     -- devis accepté
  'refused',      -- devis refusé
  'cancelled',    -- demande annulée
  'archived'      -- demande archivée
);
create type public.request_source as enum ('customer_link', 'mover_manual');
create type public.dwelling_kind as enum ('origin', 'destination');
create type public.housing_type as enum ('apartment', 'house', 'storage_unit', 'office', 'other');
create type public.elevator_type as enum ('none', 'small', 'standard', 'large');
create type public.video_status as enum ('awaiting_upload', 'uploaded', 'processing', 'ready', 'failed', 'deleted');
create type public.analysis_status as enum ('queued', 'running', 'succeeded', 'failed');
create type public.item_source as enum ('ai', 'customer', 'mover');
create type public.quote_status as enum ('draft', 'sent', 'accepted', 'refused', 'expired', 'cancelled');

-- -----------------------------------------------------------------------------
-- Clients particuliers (sans compte) d'une entreprise
-- -----------------------------------------------------------------------------
create table public.customers (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  full_name text not null check (char_length(trim(full_name)) between 1 and 120),
  email text check (char_length(email) <= 254),
  phone text check (char_length(phone) <= 30),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, company_id)
);
create index customers_company_id_idx on public.customers (company_id, created_at desc);

-- -----------------------------------------------------------------------------
-- Demandes de devis
-- -----------------------------------------------------------------------------
create table public.quote_requests (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  customer_id uuid,
  request_number integer not null,
  status public.request_status not null default 'draft',
  source public.request_source not null default 'customer_link',
  moving_date date,
  moving_date_flexible boolean not null default false,
  distance_km numeric(8, 1) check (distance_km >= 0),
  estimated_volume_m3 numeric(8, 2) check (estimated_volume_m3 >= 0),
  customer_notes text check (char_length(customer_notes) <= 4000),
  internal_notes text check (char_length(internal_notes) <= 4000),
  -- Accès du client sans compte : seul le hachage SHA-256 du jeton est stocké.
  access_token_hash text unique check (access_token_hash ~ '^[0-9a-f]{64}$'),
  access_token_expires_at timestamptz,
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, company_id),
  unique (company_id, request_number),
  foreign key (customer_id, company_id) references public.customers (id, company_id) on delete set null (customer_id)
);
create index quote_requests_company_status_idx on public.quote_requests (company_id, status, created_at desc);
comment on table public.quote_requests is 'Demande de devis d''un particulier pour une entreprise.';

-- Numéro de demande séquentiel par entreprise (DS-0001, DS-0002…).
create or replace function private.assign_request_number()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.companies
     set next_request_number = next_request_number + 1
   where id = new.company_id
  returning next_request_number - 1 into new.request_number;
  if new.request_number is null then
    raise exception 'Unknown company' using errcode = '23503';
  end if;
  return new;
end;
$$;

create trigger quote_requests_assign_number
  before insert on public.quote_requests
  for each row execute function private.assign_request_number();

-- Le numéro et le jeton d'accès ne se modifient pas depuis l'application.
create or replace function private.protect_request_system_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('authenticated', 'anon') then
    new.request_number := old.request_number;
    new.access_token_hash := old.access_token_hash;
    new.access_token_expires_at := old.access_token_expires_at;
    new.created_at := old.created_at;
  end if;
  return new;
end;
$$;

create trigger quote_requests_protect_system_fields
  before update on public.quote_requests
  for each row execute function private.protect_request_system_fields();

-- -----------------------------------------------------------------------------
-- Logements de départ et d'arrivée
-- -----------------------------------------------------------------------------
create table public.dwellings (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null,
  company_id uuid not null,
  kind public.dwelling_kind not null,
  address_line text check (char_length(address_line) <= 200),
  postal_code text check (char_length(postal_code) <= 12),
  city text check (char_length(city) <= 120),
  country text not null default 'FR' check (country ~ '^[A-Z]{2}$'),
  latitude double precision check (latitude between -90 and 90),
  longitude double precision check (longitude between -180 and 180),
  housing_type public.housing_type,
  surface_m2 integer check (surface_m2 between 1 and 10000),
  room_count integer check (room_count between 0 and 100),
  floor integer check (floor between -5 and 100),
  elevator public.elevator_type,
  carrying_distance_m integer check (carrying_distance_m between 0 and 1000),
  parking_notes text check (char_length(parking_notes) <= 1000),
  access_notes text check (char_length(access_notes) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, request_id),
  unique (request_id, kind),
  foreign key (request_id, company_id) references public.quote_requests (id, company_id) on delete cascade
);
create index dwellings_company_id_idx on public.dwellings (company_id);
comment on column public.dwellings.floor is 'Étage : 0 = rez-de-chaussée, négatif = sous-sol.';

-- -----------------------------------------------------------------------------
-- Pièces filmées
-- -----------------------------------------------------------------------------
create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null,
  company_id uuid not null,
  dwelling_id uuid,
  name text not null check (char_length(trim(name)) between 1 and 80),
  room_type text check (char_length(room_type) <= 40),
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, request_id),
  foreign key (request_id, company_id) references public.quote_requests (id, company_id) on delete cascade,
  foreign key (dwelling_id, request_id) references public.dwellings (id, request_id) on delete set null (dwelling_id)
);
create index rooms_request_id_idx on public.rooms (request_id, position);
create index rooms_company_id_idx on public.rooms (company_id);

-- -----------------------------------------------------------------------------
-- Vidéos des pièces (fichiers dans le bucket privé request-media)
-- -----------------------------------------------------------------------------
create table public.room_videos (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null,
  company_id uuid not null,
  room_id uuid not null,
  storage_path text not null unique check (char_length(storage_path) <= 400),
  mime_type text check (mime_type in ('video/mp4', 'video/webm', 'video/quicktime')),
  size_bytes bigint check (size_bytes >= 0),
  duration_seconds numeric(7, 2) check (duration_seconds >= 0),
  width integer check (width > 0),
  height integer check (height > 0),
  status public.video_status not null default 'awaiting_upload',
  failure_reason text check (char_length(failure_reason) <= 1000),
  uploaded_at timestamptz,
  delete_after timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, request_id),
  foreign key (request_id, company_id) references public.quote_requests (id, company_id) on delete cascade,
  foreign key (room_id, request_id) references public.rooms (id, request_id) on delete cascade
);
create index room_videos_room_id_idx on public.room_videos (room_id);
create index room_videos_company_id_idx on public.room_videos (company_id);
create index room_videos_delete_after_idx on public.room_videos (delete_after) where deleted_at is null;
comment on column public.room_videos.delete_after is 'Date à partir de laquelle le fichier doit être supprimé du stockage (RGPD).';

-- Images extraites des vidéos pour l'analyse
create table public.video_frames (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null,
  company_id uuid not null,
  video_id uuid not null,
  storage_path text not null unique check (char_length(storage_path) <= 400),
  captured_at_ms integer check (captured_at_ms >= 0),
  width integer check (width > 0),
  height integer check (height > 0),
  created_at timestamptz not null default now(),
  unique (id, company_id),
  foreign key (request_id, company_id) references public.quote_requests (id, company_id) on delete cascade,
  foreign key (video_id, request_id) references public.room_videos (id, request_id) on delete cascade
);
create index video_frames_video_id_idx on public.video_frames (video_id, captured_at_ms);
create index video_frames_company_id_idx on public.video_frames (company_id);

-- -----------------------------------------------------------------------------
-- Analyses IA (traçabilité : modèle, statut, erreurs, réponse brute)
-- -----------------------------------------------------------------------------
create table public.analysis_runs (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null,
  company_id uuid not null,
  status public.analysis_status not null default 'queued',
  provider text check (char_length(provider) <= 40),
  model text check (char_length(model) <= 80),
  frames_count integer check (frames_count >= 0),
  started_at timestamptz,
  finished_at timestamptz,
  error_message text check (char_length(error_message) <= 2000),
  raw_output jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, request_id),
  foreign key (request_id, company_id) references public.quote_requests (id, company_id) on delete cascade
);
create index analysis_runs_request_id_idx on public.analysis_runs (request_id, created_at desc);
create index analysis_runs_company_id_idx on public.analysis_runs (company_id);

-- -----------------------------------------------------------------------------
-- Inventaire
-- -----------------------------------------------------------------------------
create table public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null,
  company_id uuid not null,
  room_id uuid,
  analysis_run_id uuid,
  name text not null check (char_length(trim(name)) between 1 and 120),
  catalog_key text check (char_length(catalog_key) <= 120),
  quantity integer not null default 1 check (quantity between 1 and 999),
  unit_volume_m3 numeric(7, 3) not null check (unit_volume_m3 >= 0 and unit_volume_m3 <= 100),
  length_cm numeric(7, 1) check (length_cm > 0),
  width_cm numeric(7, 1) check (width_cm > 0),
  height_cm numeric(7, 1) check (height_cm > 0),
  source public.item_source not null,
  confidence numeric(4, 3) check (confidence between 0 and 1),
  possible_duplicate boolean not null default false,
  duplicate_of_item_id uuid,
  validated_by_human boolean not null default false,
  validated_by uuid references auth.users (id) on delete set null,
  validated_at timestamptz,
  removed boolean not null default false,
  is_heavy boolean not null default false,
  needs_disassembly boolean not null default false,
  is_fragile boolean not null default false,
  notes text check (char_length(notes) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (source <> 'ai' or confidence is not null),
  check (duplicate_of_item_id is null or duplicate_of_item_id <> id),
  unique (id, request_id),
  unique (id, company_id),
  foreign key (request_id, company_id) references public.quote_requests (id, company_id) on delete cascade,
  foreign key (room_id, request_id) references public.rooms (id, request_id) on delete set null (room_id),
  foreign key (analysis_run_id, request_id) references public.analysis_runs (id, request_id) on delete set null (analysis_run_id),
  foreign key (duplicate_of_item_id, request_id) references public.inventory_items (id, request_id) on delete set null (duplicate_of_item_id)
);
create index inventory_items_request_id_idx on public.inventory_items (request_id);
create index inventory_items_company_id_idx on public.inventory_items (company_id);
comment on column public.inventory_items.confidence is 'Score de l''IA entre 0 et 1 (null pour un élément saisi à la main).';

-- Images où un élément a été repéré (pour « consulter le détail de l'analyse »)
create table public.inventory_item_frames (
  item_id uuid not null,
  frame_id uuid not null,
  company_id uuid not null,
  bounding_box jsonb,
  primary key (item_id, frame_id),
  foreign key (item_id, company_id) references public.inventory_items (id, company_id) on delete cascade,
  foreign key (frame_id, company_id) references public.video_frames (id, company_id) on delete cascade
);
create index inventory_item_frames_company_id_idx on public.inventory_item_frames (company_id);

-- -----------------------------------------------------------------------------
-- Devis (génération et calcul en phase 4)
-- -----------------------------------------------------------------------------
create table public.quotes (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null,
  company_id uuid not null,
  status public.quote_status not null default 'draft',
  currency text not null default 'EUR' check (currency = 'EUR'),
  lines jsonb not null default '[]'::jsonb check (jsonb_typeof(lines) = 'array'),
  total_ht numeric(12, 2) check (total_ht >= 0),
  vat_rate numeric(5, 2) check (vat_rate between 0 and 100),
  vat_amount numeric(12, 2) check (vat_amount >= 0),
  total_ttc numeric(12, 2) check (total_ttc >= 0),
  valid_until date,
  pdf_path text check (char_length(pdf_path) <= 400),
  sent_at timestamptz,
  accepted_at timestamptz,
  refused_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (request_id, company_id) references public.quote_requests (id, company_id) on delete cascade
);
create index quotes_request_id_idx on public.quotes (request_id, created_at desc);
create index quotes_company_id_idx on public.quotes (company_id);

-- -----------------------------------------------------------------------------
-- Historique des demandes (alimenté automatiquement)
-- -----------------------------------------------------------------------------
create table public.request_events (
  id bigint generated always as identity primary key,
  request_id uuid not null,
  company_id uuid not null,
  event_type text not null check (event_type in ('created', 'status_changed', 'note')),
  from_status public.request_status,
  to_status public.request_status,
  actor_user_id uuid references auth.users (id) on delete set null,
  message text check (char_length(message) <= 2000),
  created_at timestamptz not null default now(),
  foreign key (request_id, company_id) references public.quote_requests (id, company_id) on delete cascade
);
create index request_events_request_id_idx on public.request_events (request_id, created_at);
create index request_events_company_id_idx on public.request_events (company_id);

create or replace function private.log_request_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.request_events (request_id, company_id, event_type, to_status, actor_user_id)
    values (new.id, new.company_id, 'created', new.status, (select auth.uid()));
  elsif new.status is distinct from old.status then
    insert into public.request_events (request_id, company_id, event_type, from_status, to_status, actor_user_id)
    values (new.id, new.company_id, 'status_changed', old.status, new.status, (select auth.uid()));
  end if;
  return new;
end;
$$;

create trigger quote_requests_log_event
  after insert or update of status on public.quote_requests
  for each row execute function private.log_request_event();

-- -----------------------------------------------------------------------------
-- Triggers communs : updated_at et interdiction de changer d'entreprise
-- -----------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array['customers', 'quote_requests', 'dwellings', 'rooms', 'room_videos',
                           'analysis_runs', 'inventory_items', 'quotes']
  loop
    execute format('create trigger %I before update on public.%I for each row execute function private.set_updated_at()',
                   t || '_set_updated_at', t);
  end loop;
  foreach t in array array['customers', 'quote_requests', 'dwellings', 'rooms', 'room_videos', 'video_frames',
                           'analysis_runs', 'inventory_items', 'inventory_item_frames', 'quotes']
  loop
    execute format('create trigger %I before update on public.%I for each row execute function private.forbid_company_change()',
                   t || '_forbid_company_change', t);
  end loop;
end;
$$;

-- -----------------------------------------------------------------------------
-- RLS
-- Données saisies (clients, demandes, logements, pièces, inventaire, devis) :
--   lecture, ajout, modification par tout membre ; suppression par owner/admin.
-- Données produites par le système (vidéos, images, analyses, historique) :
--   lecture seule pour les membres ; écriture par le serveur (service_role).
-- -----------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array['customers', 'quote_requests', 'dwellings', 'rooms', 'room_videos', 'video_frames',
                           'analysis_runs', 'inventory_items', 'inventory_item_frames', 'quotes', 'request_events']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format(
      'create policy %I on public.%I for select to authenticated using (company_id in (select private.user_company_ids()))',
      t || ': lecture par les membres', t);
  end loop;

  foreach t in array array['customers', 'quote_requests', 'dwellings', 'rooms', 'inventory_items', 'quotes']
  loop
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (company_id in (select private.user_company_ids()))',
      t || ': ajout par les membres', t);
    execute format(
      'create policy %I on public.%I for update to authenticated using (company_id in (select private.user_company_ids())) with check (company_id in (select private.user_company_ids()))',
      t || ': modification par les membres', t);
    execute format(
      'create policy %I on public.%I for delete to authenticated using (company_id in (select private.user_company_ids_with_role(array[''owner'', ''admin'']::public.member_role[])))',
      t || ': suppression par owner et admin', t);
  end loop;

  foreach t in array array['room_videos', 'video_frames', 'analysis_runs', 'inventory_item_frames', 'request_events']
  loop
    execute format('grant select on public.%I to authenticated', t);
  end loop;
end;
$$;

-- Notes internes ajoutées à l'historique par un membre (jamais de changement de statut à la main).
grant insert on public.request_events to authenticated;
create policy "request_events: note ajoutée par un membre"
  on public.request_events for insert to authenticated
  with check (
    company_id in (select private.user_company_ids())
    and event_type = 'note'
    and actor_user_id = (select auth.uid())
    and from_status is null and to_status is null
  );
