-- =============================================================================
-- Devis Scan — phase 4 : catalogue mobilier, analyse IA, inventaire corrigeable,
-- devis versionnés.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Registre des sources et catalogue mobilier (référentiel commun à toutes les entreprises)
-- -----------------------------------------------------------------------------
create table public.catalog_sources (
  id text primary key,
  name text not null,
  url text,
  licence text not null,
  author text,
  consulted_on date not null,
  terms text,
  modifications text,
  imported_data text,
  integrated boolean not null default true
);

insert into public.catalog_sources (id, name, url, licence, author, consulted_on, terms, modifications, imported_data, integrated) values
  ('abo', 'Amazon Berkeley Objects (ABO)', 'https://amazon-berkeley-objects.s3.amazonaws.com/index.html', 'CC BY 4.0',
   'Amazon.com ; Collins et al., UC Berkeley (CVPR 2022)', '2026-11-24',
   'Attribution obligatoire (Amazon.com), lien vers la licence, indication des modifications.',
   'Sélection de produits par règles, conversion d''unités, percentiles 10/50/90, libellés traduits.',
   'Métadonnées produits uniquement (dimensions, poids, catégories) ; aucune image ni modèle 3D.', true),
  ('proto', 'Table de volumes du prototype Devis Scan', null, 'Interne (porteur du projet)', 'Devis Scan', '2026-11-24',
   'Usage interne.', 'Aucune.', '36 volumes de déménagement (m³).', true),
  ('ds', 'Méthodes Devis Scan', null, 'Interne', 'Devis Scan', '2026-11-24', 'Usage interne.',
   'Coefficients de manutention et dérivations documentés (hypothèses à calibrer).', 'Taxonomie, synonymes, règles.', true),
  ('afde', 'Grille d''équivalence volumétrique AFDE (guide UCANSS 2017)',
   'https://guideachats.ucanss.fr/res/Fche_demenagement_Decembre2017.pdf', 'Non établie', 'AFDE / UCANSS', '2026-11-24',
   'Document inaccessible ; conditions de réutilisation non établies.', null, 'Aucune donnée intégrée.', false),
  ('coco', 'COCO (Common Objects in Context)', 'https://cocodataset.org/', 'Annotations CC BY 4.0 ; images conditions Flickr',
   'COCO Consortium', '2026-11-24', 'Utilisé uniquement comme taxonomie de classes.', null, 'Noms de classes (taxonomie).', false);

create table public.furniture_catalog (
  id text primary key check (id ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null,
  category text not null,
  category_label text not null,
  subcategory text not null,
  synonyms text[] not null default '{}',
  coco_class text,
  handling text not null check (handling in ('rigide', 'rembourre', 'empilable', 'demontable', 'fragile')),
  heavy boolean not null default false,
  sample_size integer not null default 0,
  dims_cm jsonb,
  geometric_volume_min numeric(8, 3),
  geometric_volume_avg numeric(8, 3),
  geometric_volume_max numeric(8, 3),
  professional_volume numeric(8, 3),
  moving_volume_min numeric(8, 3),
  moving_volume_avg numeric(8, 3),
  moving_volume_max numeric(8, 3),
  weight_kg_avg numeric(8, 1),
  dims_reliability text not null check (dims_reliability in ('elevee', 'moyenne', 'aucune')),
  moving_volume_reliability text not null check (moving_volume_reliability in ('moyenne', 'faible', 'aucune')),
  sources text[] not null default '{}',
  method text not null,
  updated_on date not null
);

comment on table public.furniture_catalog is 'Catalogue mobilier Devis Scan (voir docs/catalogue-sources.md). Volume géométrique ≠ volume de déménagement.';

alter table public.catalog_sources enable row level security;
alter table public.furniture_catalog enable row level security;
revoke all on public.catalog_sources, public.furniture_catalog from anon, authenticated;
grant select on public.catalog_sources, public.furniture_catalog to anon, authenticated;
create policy "catalog_sources: lecture publique" on public.catalog_sources for select to anon, authenticated using (true);
create policy "furniture_catalog: lecture publique" on public.furniture_catalog for select to anon, authenticated using (true);

-- -----------------------------------------------------------------------------
-- Inventaire : référence catalogue, fourchettes de volume, proposition IA d'origine
-- -----------------------------------------------------------------------------
alter table public.inventory_items
  add column category text check (char_length(category) <= 60),
  add column unit_volume_min_m3 numeric(7, 3) check (unit_volume_min_m3 >= 0),
  add column unit_volume_max_m3 numeric(7, 3) check (unit_volume_max_m3 >= 0),
  add column geometric_volume_m3 numeric(7, 3) check (geometric_volume_m3 >= 0),
  add column volume_source text check (volume_source in ('catalog', 'dimensions', 'human', 'unknown')),
  add column visibility text check (visibility in ('visible', 'partial', 'uncertain')),
  add column ai_label text check (char_length(ai_label) <= 200),
  add column ai_proposal jsonb,
  add column human_modified boolean not null default false,
  add column merged_into_item_id uuid;

alter table public.inventory_items
  add constraint inventory_items_catalog_fk foreign key (catalog_key) references public.furniture_catalog (id) on delete set null,
  add constraint inventory_items_merged_fk foreign key (merged_into_item_id, request_id) references public.inventory_items (id, request_id) on delete set null (merged_into_item_id);

comment on column public.inventory_items.ai_proposal is 'Proposition d''origine de l''IA (jamais modifiée) : permet de comparer avec les corrections humaines.';
comment on column public.inventory_items.unit_volume_m3 is 'Volume de déménagement unitaire retenu (m³).';

-- Journal des corrections humaines
create table public.inventory_item_changes (
  id bigint generated always as identity primary key,
  item_id uuid,
  request_id uuid not null,
  company_id uuid not null,
  action text not null check (action in ('add', 'update', 'remove', 'restore', 'merge', 'confirm')),
  changes jsonb not null default '{}'::jsonb,
  volume_before_m3 numeric(9, 3),
  volume_after_m3 numeric(9, 3),
  changed_by uuid references auth.users (id) on delete set null,
  changed_at timestamptz not null default now(),
  foreign key (request_id, company_id) references public.quote_requests (id, company_id) on delete cascade
);
create index inventory_item_changes_request_idx on public.inventory_item_changes (request_id, changed_at desc);
create index inventory_item_changes_company_idx on public.inventory_item_changes (company_id);

alter table public.inventory_item_changes enable row level security;
revoke all on public.inventory_item_changes from anon, authenticated;
grant select, insert on public.inventory_item_changes to authenticated;
create policy "inventory_item_changes: lecture par les membres" on public.inventory_item_changes
  for select to authenticated using (company_id in (select private.user_company_ids()));
create policy "inventory_item_changes: ajout par les membres" on public.inventory_item_changes
  for insert to authenticated with check (company_id in (select private.user_company_ids()) and changed_by = (select auth.uid()));

-- -----------------------------------------------------------------------------
-- Analyses IA : progression, coûts, simulation signalée
-- -----------------------------------------------------------------------------
alter table public.analysis_runs
  add column stage text check (stage in ('queued', 'rooms', 'recognition', 'volumes', 'pricing', 'quote', 'done', 'failed')),
  add column rooms_total integer check (rooms_total >= 0),
  add column rooms_done integer check (rooms_done >= 0),
  add column images_count integer check (images_count >= 0),
  add column input_tokens integer check (input_tokens >= 0),
  add column output_tokens integer check (output_tokens >= 0),
  add column cost_usd numeric(10, 5) check (cost_usd >= 0),
  add column simulated boolean not null default false,
  add column error_code text check (char_length(error_code) <= 60);

comment on column public.analysis_runs.simulated is 'Vrai si l''analyse a été produite par le simulateur de test (jamais une vraie analyse IA).';

-- Une seule analyse en cours par demande (évite les analyses facturées deux fois).
create unique index analysis_runs_one_active on public.analysis_runs (request_id) where status in ('queued', 'running');

-- -----------------------------------------------------------------------------
-- Tarifs : configuration explicite et type de voyage
-- -----------------------------------------------------------------------------
alter table public.pricing_settings
  add column configured_at timestamptz,
  add column trip_type text check (trip_type in ('dedie', 'groupage'));
comment on column public.pricing_settings.configured_at is 'Date à laquelle l''entreprise a enregistré sa grille. Sans elle, aucun devis automatique n''est établi.';
comment on column public.pricing_settings.trip_type is 'Type de voyage annoncé sur les devis : véhicule dédié ou groupage.';

create or replace function private.mark_pricing_configured()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user = 'authenticated' then
    new.configured_at := now();
  end if;
  return new;
end;
$$;

create trigger pricing_settings_mark_configured
  before update on public.pricing_settings
  for each row execute function private.mark_pricing_configured();

-- -----------------------------------------------------------------------------
-- Mentions des devis configurées par l'entreprise (jamais rédigées par Devis Scan)
-- -----------------------------------------------------------------------------
alter table public.companies
  add column reserves_terms text check (char_length(reserves_terms) <= 4000),
  add column liability_terms text check (char_length(liability_terms) <= 4000);
comment on column public.companies.reserves_terms is 'Procédure de réserves à la livraison, rédigée par l''entreprise.';
comment on column public.companies.liability_terms is 'Responsabilité de l''entreprise et garanties, rédigées par l''entreprise.';

-- -----------------------------------------------------------------------------
-- Demandes : options choisies par le client, distance, lien de consultation du devis
-- -----------------------------------------------------------------------------
alter table public.quote_requests
  add column selected_options jsonb not null default '[]'::jsonb check (jsonb_typeof(selected_options) = 'array'),
  add column distance_method text check (distance_method in ('route', 'estimate')),
  add column view_token_hash text unique check (view_token_hash ~ '^[0-9a-f]{64}$');

-- -----------------------------------------------------------------------------
-- Devis versionnés
-- -----------------------------------------------------------------------------
alter type public.quote_status add value if not exists 'generated';
alter type public.quote_status add value if not exists 'corrected';
alter type public.quote_status add value if not exists 'superseded';

alter table public.quotes
  add column version integer not null default 1 check (version >= 1),
  add column kind text not null default 'estimate' check (kind in ('formal', 'estimate')),
  add column origin text not null default 'automatic' check (origin in ('automatic', 'correction', 'manual')),
  add column supersedes_id uuid,
  add column distance_km numeric(8, 1),
  add column distance_method text check (distance_method in ('route', 'estimate')),
  add column volume_snapshot jsonb,
  add column pricing_snapshot jsonb,
  add column company_snapshot jsonb,
  add column request_snapshot jsonb,
  add column inventory_snapshot jsonb,
  add column assumptions jsonb not null default '[]'::jsonb,
  add column changes_summary jsonb,
  add column total_ht_cents bigint check (total_ht_cents >= 0),
  add column vat_cents bigint check (vat_cents >= 0),
  add column total_ttc_cents bigint check (total_ttc_cents >= 0),
  add unique (request_id, version),
  add unique (id, request_id),
  add constraint quotes_supersedes_fk foreign key (supersedes_id, request_id) references public.quotes (id, request_id);

comment on column public.quotes.pricing_snapshot is 'Instantané de la grille tarifaire utilisée : une modification ultérieure de la grille ne change pas ce devis.';

-- Un devis est figé : seuls le statut et ses dates évoluent.
create or replace function private.freeze_quote()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (new.lines, new.total_ht, new.vat_rate, new.vat_amount, new.total_ttc, new.total_ht_cents, new.vat_cents, new.total_ttc_cents,
      new.version, new.kind, new.origin, new.pricing_snapshot, new.volume_snapshot, new.company_snapshot, new.request_snapshot,
      new.inventory_snapshot, new.assumptions, new.valid_until, new.request_id, new.supersedes_id, new.created_at)
     is distinct from
     (old.lines, old.total_ht, old.vat_rate, old.vat_amount, old.total_ttc, old.total_ht_cents, old.vat_cents, old.total_ttc_cents,
      old.version, old.kind, old.origin, old.pricing_snapshot, old.volume_snapshot, old.company_snapshot, old.request_snapshot,
      old.inventory_snapshot, old.assumptions, old.valid_until, old.request_id, old.supersedes_id, old.created_at) then
    raise exception 'A quote version cannot be modified; create a new version' using errcode = '55000';
  end if;
  if old.status = 'accepted' and new.status <> 'accepted' then
    raise exception 'An accepted quote cannot change status' using errcode = '55000';
  end if;
  return new;
end;
$$;

create trigger quotes_freeze before update on public.quotes for each row execute function private.freeze_quote();

-- Pas de suppression d'un devis (historique conservé).
drop policy if exists "quotes: suppression par owner et admin" on public.quotes;
revoke delete on public.quotes from authenticated;

-- -----------------------------------------------------------------------------
-- Accès du particulier : options proposées, choix, devis
-- -----------------------------------------------------------------------------
create or replace function public.get_public_company_options(company_slug text)
returns table (id uuid, name text, description text, pricing_mode public.pricing_mode, price numeric)
language sql
stable
security definer
set search_path = ''
as $$
  select o.id, o.name, o.description, o.pricing_mode, o.price
  from public.pricing_options o
  join public.companies c on c.id = o.company_id
  where c.slug = lower(company_slug) and o.is_active
  order by o.position, o.created_at;
$$;

create or replace function public.set_public_options(access_token text, options jsonb)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  req public.quote_requests := private.request_for_token(access_token, true);
  cleaned jsonb := '[]'::jsonb;
  o jsonb;
begin
  if jsonb_typeof(options) <> 'array' or jsonb_array_length(options) > 30 then
    raise exception 'Invalid options' using errcode = '22023';
  end if;
  for o in select * from jsonb_array_elements(options) loop
    if not exists (select 1 from public.pricing_options p
                   where p.id::text = o ->> 'option_id' and p.company_id = req.company_id and p.is_active) then
      raise exception 'Unknown option' using errcode = '22023';
    end if;
    cleaned := cleaned || jsonb_build_array(jsonb_build_object(
      'option_id', o ->> 'option_id',
      'quantity', greatest(1, least(99, coalesce(nullif(o ->> 'quantity', '')::integer, 1)))));
  end loop;
  update public.quote_requests set selected_options = cleaned where id = req.id;
end;
$$;

create or replace function public.get_public_selected_options(access_token text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select (private.request_for_token(access_token, false)).selected_options;
$$;
revoke all on function public.get_public_selected_options(text) from public;
grant execute on function public.get_public_selected_options(text) to anon, authenticated, service_role;

-- Lien de consultation du devis (lecture seule) remis à l'envoi de la demande.
drop function if exists public.submit_public_request(text);
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

-- Demande correspondant à un jeton d'accès (brouillon) OU à un jeton de consultation.
create or replace function private.request_for_any_token(token text)
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
  select * into found from public.quote_requests
   where view_token_hash = private.token_hash(token)
      or (access_token_hash = private.token_hash(token) and access_token_expires_at > now());
  if found.id is null then
    raise exception 'Invalid or expired link' using errcode = '42501';
  end if;
  return found;
end;
$$;
revoke all on function private.request_for_any_token(text) from public;

-- Suivi de l'analyse et devis visibles par le particulier (aucun identifiant interne inutile).
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
    'analysis', (select jsonb_build_object('status', a.status, 'stage', a.stage, 'rooms_total', a.rooms_total,
                                           'rooms_done', a.rooms_done, 'simulated', a.simulated, 'error_code', a.error_code)
                 from public.analysis_runs a where a.request_id = req.id order by a.created_at desc limit 1),
    'quotes', coalesce((select jsonb_agg(jsonb_build_object(
                 'id', q.id, 'version', q.version, 'status', q.status, 'kind', q.kind, 'origin', q.origin, 'created_at', q.created_at,
                 'valid_until', q.valid_until, 'lines', q.lines, 'total_ht_cents', q.total_ht_cents, 'vat_cents', q.vat_cents,
                 'total_ttc_cents', q.total_ttc_cents, 'vat_rate', q.vat_rate, 'distance_km', q.distance_km,
                 'distance_method', q.distance_method, 'volume', q.volume_snapshot, 'company', q.company_snapshot,
                 'request', q.request_snapshot, 'inventory', q.inventory_snapshot, 'assumptions', q.assumptions,
                 'changes', q.changes_summary, 'sent_at', q.sent_at, 'accepted_at', q.accepted_at)
               order by q.version desc)
               from public.quotes q where q.request_id = req.id and q.status <> 'draft'), '[]'::jsonb)
  );
end;
$$;

-- Réponse du particulier à un devis ENVOYÉ par le déménageur (jamais à une estimation automatique).
create or replace function public.respond_public_quote(token text, quote_id uuid, decision text)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  req public.quote_requests := private.request_for_any_token(token);
  q public.quotes;
begin
  if decision not in ('accepted', 'refused') then
    raise exception 'Invalid decision' using errcode = '22023';
  end if;
  select * into q from public.quotes where id = quote_id and request_id = req.id for update;
  if q.id is null then
    raise exception 'Unknown quote' using errcode = '42501';
  end if;
  if q.status <> 'sent' then
    raise exception 'Quote cannot be answered' using errcode = '55000';
  end if;
  if q.valid_until is not null and q.valid_until < current_date then
    update public.quotes set status = 'expired' where id = q.id;
    return 'expired';
  end if;
  if decision = 'accepted' then
    update public.quotes set status = 'accepted', accepted_at = now() where id = q.id;
    update public.quote_requests set status = 'accepted' where id = req.id;
  else
    update public.quotes set status = 'refused', refused_at = now() where id = q.id;
    update public.quote_requests set status = 'refused' where id = req.id;
  end if;
  return decision;
end;
$$;
revoke all on function public.respond_public_quote(text, uuid, text) from public;
grant execute on function public.respond_public_quote(text, uuid, text) to anon, authenticated, service_role;

revoke all on function public.get_public_company_options(text) from public;
revoke all on function public.set_public_options(text, jsonb) from public;
revoke all on function public.submit_public_request(text) from public;
revoke all on function public.get_public_quote_view(text) from public;
grant execute on function public.get_public_company_options(text) to anon, authenticated, service_role;
grant execute on function public.set_public_options(text, jsonb) to anon, authenticated, service_role;
grant execute on function public.submit_public_request(text) to anon, authenticated, service_role;
grant execute on function public.get_public_quote_view(text) to anon, authenticated, service_role;
