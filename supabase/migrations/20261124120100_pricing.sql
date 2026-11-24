-- =============================================================================
-- Devis Scan — paramètres tarifaires de chaque entreprise.
-- Les montants sont HT, en euros. Les calculs complets du devis viendront
-- en phase 4 ; la structure est prête et modifiable dès maintenant.
-- =============================================================================

create type public.pricing_mode as enum ('fixed', 'per_m3', 'per_item');

create table public.pricing_settings (
  company_id uuid primary key references public.companies (id) on delete cascade,
  currency text not null default 'EUR' check (currency = 'EUR'),
  price_per_m3 numeric(10, 2) not null default 85 check (price_per_m3 >= 0),
  minimum_price numeric(10, 2) not null default 380 check (minimum_price >= 0),
  travel_fee numeric(10, 2) not null default 0 check (travel_fee >= 0),
  included_distance_km integer not null default 50 check (included_distance_km >= 0),
  price_per_extra_km numeric(10, 2) not null default 0.9 check (price_per_extra_km >= 0),
  floor_fee_without_elevator numeric(10, 2) not null default 22 check (floor_fee_without_elevator >= 0),
  floor_fee_small_elevator numeric(10, 2) not null default 0 check (floor_fee_small_elevator >= 0),
  free_carrying_distance_m integer not null default 10 check (free_carrying_distance_m >= 0),
  carrying_fee_per_10m numeric(10, 2) not null default 0 check (carrying_fee_per_10m >= 0),
  heavy_item_fee numeric(10, 2) not null default 65 check (heavy_item_fee >= 0),
  vat_rate numeric(5, 2) not null default 20 check (vat_rate between 0 and 100),
  updated_at timestamptz not null default now()
);

comment on table public.pricing_settings is 'Grille tarifaire principale (une ligne par entreprise, créée avec l''entreprise).';
comment on column public.pricing_settings.travel_fee is 'Frais de déplacement fixes ajoutés à chaque devis.';
comment on column public.pricing_settings.included_distance_km is 'Distance incluse ; au-delà, price_per_extra_km s''applique.';
comment on column public.pricing_settings.floor_fee_without_elevator is 'Supplément par étage sans ascenseur (départ et arrivée).';
comment on column public.pricing_settings.floor_fee_small_elevator is 'Supplément par étage avec un petit ascenseur.';
comment on column public.pricing_settings.carrying_fee_per_10m is 'Supplément par tranche de 10 m de portage au-delà de free_carrying_distance_m.';
comment on column public.pricing_settings.heavy_item_fee is 'Supplément par défaut pour un objet lourd sans tarif spécifique.';

create trigger pricing_settings_set_updated_at
  before update on public.pricing_settings
  for each row execute function private.set_updated_at();

create trigger pricing_settings_forbid_company_change
  before update on public.pricing_settings
  for each row execute function private.forbid_company_change();

-- Options et prestations complémentaires (démontage, emballage, garde-meubles…).
create table public.pricing_options (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 2 and 120),
  description text check (char_length(description) <= 500),
  pricing_mode public.pricing_mode not null default 'fixed',
  price numeric(10, 2) not null check (price >= 0),
  is_active boolean not null default true,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index pricing_options_company_id_idx on public.pricing_options (company_id, position);

create trigger pricing_options_set_updated_at
  before update on public.pricing_options
  for each row execute function private.set_updated_at();

create trigger pricing_options_forbid_company_change
  before update on public.pricing_options
  for each row execute function private.forbid_company_change();

-- Objets volumineux ou spécifiques avec un supplément dédié (piano, coffre-fort…).
create table public.pricing_item_surcharges (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 2 and 120),
  surcharge numeric(10, 2) not null check (surcharge >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, name)
);

create trigger pricing_item_surcharges_set_updated_at
  before update on public.pricing_item_surcharges
  for each row execute function private.set_updated_at();

create trigger pricing_item_surcharges_forbid_company_change
  before update on public.pricing_item_surcharges
  for each row execute function private.forbid_company_change();

-- -----------------------------------------------------------------------------
-- RLS : lecture par tous les membres, modification par owner et admin.
-- -----------------------------------------------------------------------------
alter table public.pricing_settings enable row level security;
alter table public.pricing_options enable row level security;
alter table public.pricing_item_surcharges enable row level security;

create policy "pricing_settings: lecture par les membres"
  on public.pricing_settings for select to authenticated
  using (company_id in (select private.user_company_ids()));
create policy "pricing_settings: modification par owner et admin"
  on public.pricing_settings for update to authenticated
  using (company_id in (select private.user_company_ids_with_role(array['owner', 'admin']::public.member_role[])))
  with check (company_id in (select private.user_company_ids_with_role(array['owner', 'admin']::public.member_role[])));

create policy "pricing_options: lecture par les membres"
  on public.pricing_options for select to authenticated
  using (company_id in (select private.user_company_ids()));
create policy "pricing_options: ajout par owner et admin"
  on public.pricing_options for insert to authenticated
  with check (company_id in (select private.user_company_ids_with_role(array['owner', 'admin']::public.member_role[])));
create policy "pricing_options: modification par owner et admin"
  on public.pricing_options for update to authenticated
  using (company_id in (select private.user_company_ids_with_role(array['owner', 'admin']::public.member_role[])))
  with check (company_id in (select private.user_company_ids_with_role(array['owner', 'admin']::public.member_role[])));
create policy "pricing_options: suppression par owner et admin"
  on public.pricing_options for delete to authenticated
  using (company_id in (select private.user_company_ids_with_role(array['owner', 'admin']::public.member_role[])));

create policy "pricing_item_surcharges: lecture par les membres"
  on public.pricing_item_surcharges for select to authenticated
  using (company_id in (select private.user_company_ids()));
create policy "pricing_item_surcharges: ajout par owner et admin"
  on public.pricing_item_surcharges for insert to authenticated
  with check (company_id in (select private.user_company_ids_with_role(array['owner', 'admin']::public.member_role[])));
create policy "pricing_item_surcharges: modification par owner et admin"
  on public.pricing_item_surcharges for update to authenticated
  using (company_id in (select private.user_company_ids_with_role(array['owner', 'admin']::public.member_role[])))
  with check (company_id in (select private.user_company_ids_with_role(array['owner', 'admin']::public.member_role[])));
create policy "pricing_item_surcharges: suppression par owner et admin"
  on public.pricing_item_surcharges for delete to authenticated
  using (company_id in (select private.user_company_ids_with_role(array['owner', 'admin']::public.member_role[])));

revoke all on public.pricing_settings, public.pricing_options, public.pricing_item_surcharges from anon, authenticated;
grant select, update on public.pricing_settings to authenticated;
grant select, insert, update, delete on public.pricing_options, public.pricing_item_surcharges to authenticated;

-- -----------------------------------------------------------------------------
-- Création d'une entreprise par un utilisateur connecté.
-- Crée en une seule transaction : l'entreprise, le rôle owner, la grille
-- tarifaire par défaut et les deux options reprises du prototype.
-- -----------------------------------------------------------------------------
create or replace function public.create_company(company_name text)
returns public.companies
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  clean_name text := trim(company_name);
  base_slug text;
  candidate text;
  suffix integer := 1;
  created public.companies;
begin
  if uid is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if clean_name is null or char_length(clean_name) not between 2 and 120 then
    raise exception 'Company name must contain 2 to 120 characters' using errcode = '22023';
  end if;
  -- Pour l'instant : une entreprise créée par compte (les invitations viendront ensuite).
  if exists (select 1 from public.company_members where user_id = uid) then
    raise exception 'User already belongs to a company' using errcode = '23505';
  end if;

  base_slug := left(private.slugify(clean_name), 50);
  if char_length(base_slug) < 3 then
    base_slug := 'entreprise';
  end if;
  base_slug := trim(both '-' from base_slug);
  candidate := base_slug;
  while exists (select 1 from public.companies where slug = candidate) loop
    suffix := suffix + 1;
    candidate := base_slug || '-' || suffix;
  end loop;

  insert into public.companies (name, slug)
  values (clean_name, candidate)
  returning * into created;

  insert into public.company_members (company_id, user_id, role)
  values (created.id, uid, 'owner');

  insert into public.pricing_settings (company_id) values (created.id);

  insert into public.pricing_options (company_id, name, description, pricing_mode, price, position)
  values
    (created.id, 'Démontage et remontage des meubles', 'Lits, armoires et meubles à démonter.', 'fixed', 55, 1),
    (created.id, 'Emballage des objets fragiles', 'Vaisselle, verrerie, objets de valeur.', 'fixed', 75, 2);

  return created;
end;
$$;

revoke all on function public.create_company(text) from public, anon;
grant execute on function public.create_company(text) to authenticated;
