-- =============================================================================
-- Devis Scan — fondations : profils, entreprises, membres, rôles.
--
-- Principe multi-entreprises : chaque donnée métier porte un `company_id`.
-- Les règles RLS n'autorisent l'accès qu'aux membres de cette entreprise.
-- Les fonctions d'aide « security definer » vivent dans le schéma `private`,
-- qui n'est pas exposé par l'API.
-- =============================================================================

create extension if not exists unaccent with schema extensions;

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated, service_role;

-- Les visiteurs anonymes n'accèdent jamais directement aux tables :
-- le parcours client passera par des fonctions contrôlées.
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on sequences from anon;
alter default privileges in schema public revoke execute on functions from anon, public;

-- -----------------------------------------------------------------------------
-- Types
-- -----------------------------------------------------------------------------
create type public.member_role as enum ('owner', 'admin', 'member');

-- -----------------------------------------------------------------------------
-- Utilitaires
-- -----------------------------------------------------------------------------
create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Interdit de déplacer une ligne vers une autre entreprise.
create or replace function private.forbid_company_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.company_id is distinct from old.company_id then
    raise exception 'company_id cannot be changed' using errcode = '42501';
  end if;
  return new;
end;
$$;

-- Transforme un nom en identifiant d'URL : « Déménagements Martin » -> « demenagements-martin ».
create or replace function private.slugify(value text)
returns text
language sql
immutable
set search_path = ''
as $$
  select trim(both '-' from regexp_replace(lower(extensions.unaccent(coalesce(value, ''))), '[^a-z0-9]+', '-', 'g'));
$$;

-- -----------------------------------------------------------------------------
-- Profils utilisateurs (1 ligne par compte Supabase Auth)
-- -----------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text check (char_length(full_name) <= 120),
  phone text check (char_length(phone) <= 30),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is 'Informations personnelles d''un utilisateur (déménageur).';

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function private.set_updated_at();

-- Création automatique du profil à l'inscription.
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, nullif(left(trim(new.raw_user_meta_data ->> 'full_name'), 120), ''));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- -----------------------------------------------------------------------------
-- Entreprises de déménagement
-- -----------------------------------------------------------------------------
create table public.companies (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique
    check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) between 3 and 60),
  name text not null check (char_length(trim(name)) between 2 and 120),
  legal_name text check (char_length(legal_name) <= 160),
  siret text check (siret ~ '^[0-9]{14}$'),
  vat_number text check (char_length(vat_number) <= 20),
  email text check (char_length(email) <= 254),
  phone text check (char_length(phone) <= 30),
  website text check (char_length(website) <= 200),
  address_line1 text check (char_length(address_line1) <= 200),
  address_line2 text check (char_length(address_line2) <= 200),
  postal_code text check (char_length(postal_code) <= 12),
  city text check (char_length(city) <= 120),
  country text not null default 'FR' check (country ~ '^[A-Z]{2}$'),
  logo_path text check (char_length(logo_path) <= 300),
  brand_color text check (brand_color ~ '^#[0-9a-f]{6}$'),
  quote_validity_days integer not null default 30 check (quote_validity_days between 1 and 365),
  payment_terms text check (char_length(payment_terms) <= 2000),
  quote_terms text check (char_length(quote_terms) <= 10000),
  insurance_info text check (char_length(insurance_info) <= 2000),
  video_retention_days integer not null default 90 check (video_retention_days between 7 and 365),
  request_reference_prefix text not null default 'DS'
    check (request_reference_prefix ~ '^[A-Z0-9]{1,6}$'),
  next_request_number integer not null default 1 check (next_request_number > 0),
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.companies is 'Entreprise de déménagement cliente du SaaS (un espace indépendant par entreprise).';
comment on column public.companies.slug is 'Identifiant du lien personnalisé de demande de devis.';
comment on column public.companies.video_retention_days is 'Durée de conservation des vidéos avant suppression réelle du stockage.';
comment on column public.companies.next_request_number is 'Compteur interne des numéros de demande (géré par trigger).';

create trigger companies_set_updated_at
  before update on public.companies
  for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
-- Membres d'une entreprise et rôles
-- -----------------------------------------------------------------------------
create table public.company_members (
  company_id uuid not null references public.companies (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.member_role not null default 'member',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (company_id, user_id)
);

create index company_members_user_id_idx on public.company_members (user_id);

comment on table public.company_members is 'Rattachement utilisateur ↔ entreprise. owner : tout ; admin : paramètres ; member : demandes.';

create trigger company_members_set_updated_at
  before update on public.company_members
  for each row execute function private.set_updated_at();

create trigger company_members_forbid_company_change
  before update on public.company_members
  for each row execute function private.forbid_company_change();

-- Une entreprise garde toujours au moins un propriétaire.
create or replace function private.keep_one_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.role = 'owner'
     and (tg_op = 'DELETE' or new.role <> 'owner')
     and exists (select 1 from public.companies c where c.id = old.company_id)
     and not exists (
       select 1 from public.company_members m
       where m.company_id = old.company_id and m.role = 'owner' and m.user_id <> old.user_id
     ) then
    raise exception 'A company must keep at least one owner' using errcode = '23514';
  end if;
  return coalesce(new, old);
end;
$$;

create trigger company_members_keep_one_owner
  before update or delete on public.company_members
  for each row execute function private.keep_one_owner();

-- -----------------------------------------------------------------------------
-- Fonctions d'aide pour les règles RLS
-- -----------------------------------------------------------------------------

-- Entreprises dont l'utilisateur connecté est membre.
create or replace function private.user_company_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select company_id from public.company_members where user_id = (select auth.uid());
$$;

-- Entreprises où l'utilisateur a l'un des rôles donnés.
create or replace function private.user_company_ids_with_role(roles public.member_role[])
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select company_id from public.company_members
  where user_id = (select auth.uid()) and role = any (roles);
$$;

revoke all on function private.user_company_ids() from public;
revoke all on function private.user_company_ids_with_role(public.member_role[]) from public;
grant execute on function private.user_company_ids() to authenticated, service_role;
grant execute on function private.user_company_ids_with_role(public.member_role[]) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- RLS : profils, entreprises, membres
-- -----------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.companies enable row level security;
alter table public.company_members enable row level security;

-- Profils : soi-même, et les collègues des mêmes entreprises (noms affichés dans l'équipe).
create policy "profiles: lecture soi-même et collègues"
  on public.profiles for select to authenticated
  using (
    id = (select auth.uid())
    or id in (
      select m.user_id from public.company_members m
      where m.company_id in (select private.user_company_ids())
    )
  );

create policy "profiles: modification de son propre profil"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- Entreprises : lecture par les membres, modification par owner/admin.
-- La création passe par public.create_company() ; pas de suppression via l'API.
create policy "companies: lecture par les membres"
  on public.companies for select to authenticated
  using (id in (select private.user_company_ids()));

create policy "companies: modification par owner et admin"
  on public.companies for update to authenticated
  using (id in (select private.user_company_ids_with_role(array['owner', 'admin']::public.member_role[])))
  with check (id in (select private.user_company_ids_with_role(array['owner', 'admin']::public.member_role[])));

-- Champs gérés par le système : jamais modifiables par un utilisateur.
create or replace function private.protect_company_system_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('authenticated', 'anon') then
    new.id := old.id;
    new.next_request_number := old.next_request_number;
    new.is_demo := old.is_demo;
    new.created_at := old.created_at;
  end if;
  return new;
end;
$$;

create trigger companies_protect_system_fields
  before update on public.companies
  for each row execute function private.protect_company_system_fields();

-- Membres : visibles par les membres de la même entreprise ; gérés par le propriétaire.
create policy "company_members: lecture par les membres"
  on public.company_members for select to authenticated
  using (company_id in (select private.user_company_ids()));

create policy "company_members: ajout par le propriétaire"
  on public.company_members for insert to authenticated
  with check (company_id in (select private.user_company_ids_with_role(array['owner']::public.member_role[])));

create policy "company_members: modification par le propriétaire"
  on public.company_members for update to authenticated
  using (company_id in (select private.user_company_ids_with_role(array['owner']::public.member_role[])))
  with check (company_id in (select private.user_company_ids_with_role(array['owner']::public.member_role[])));

create policy "company_members: retrait par le propriétaire ou départ volontaire"
  on public.company_members for delete to authenticated
  using (
    company_id in (select private.user_company_ids_with_role(array['owner']::public.member_role[]))
    or user_id = (select auth.uid())
  );

revoke all on public.profiles, public.companies, public.company_members from anon, authenticated;
grant select, update on public.profiles to authenticated;
grant select, update on public.companies to authenticated;
grant select, insert, update, delete on public.company_members to authenticated;
