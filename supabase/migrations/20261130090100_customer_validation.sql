-- =============================================================================
-- Validation de l'inventaire par le client, devis final immédiat, vérification
-- par le déménageur en parallèle, avenants, e-mails préparés (26/11/2026).
--
-- Deux suivis indépendants :
--   - le devis : quote_requests.status (awaiting_customer → quote_sent → accepted / refused)
--     et quotes (versions, avenants) ;
--   - la vérification humaine : quote_requests.verification_status
--     (not_required → pending → verified | corrected).
-- Les décisions du client et celles du déménageur sont stockées séparément :
-- le déménageur ne peut jamais écraser une décision du client.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Demande : validation par le client et suivi de la vérification
-- -----------------------------------------------------------------------------
alter table public.quote_requests
  add column verification_status text not null default 'not_required'
    check (verification_status in ('not_required', 'pending', 'verified', 'corrected')),
  add column customer_validated_at timestamptz,
  add column customer_acknowledged_at timestamptz,
  add column customer_acknowledgement text check (char_length(customer_acknowledgement) <= 2000),
  add column verified_at timestamptz,
  add column verified_by uuid references auth.users (id) on delete set null;

comment on column public.quote_requests.verification_status is
  'Vérification humaine, indépendante du devis : not_required (pas encore validé par le client), pending (en attente), verified (décisions du client confirmées), corrected (inventaire corrigé par le déménageur).';
comment on column public.quote_requests.customer_acknowledgement is
  'Texte exact de l''avertissement accepté par le client lors de la validation de son inventaire.';

-- -----------------------------------------------------------------------------
-- Inventaire : décision du client et décision du déménageur, séparées
-- -----------------------------------------------------------------------------
alter table public.inventory_items
  add column customer_duplicate_decision text check (customer_duplicate_decision in ('distinct', 'same')),
  add column customer_decided_at timestamptz,
  add column mover_duplicate_decision text check (mover_duplicate_decision in ('distinct', 'same')),
  add column mover_decided_at timestamptz,
  add column mover_decided_by uuid references auth.users (id) on delete set null;

comment on column public.inventory_items.customer_duplicate_decision is
  'Réponse du client à un doublon possible : distinct (un autre meuble, compté) ou same (le même meuble, compté une seule fois). Jamais modifiée après la validation.';
comment on column public.inventory_items.mover_duplicate_decision is
  'Décision du déménageur lors de la vérification ; prime sur celle du client pour le calcul, sans l''effacer.';

-- La décision du client n'est posée que par la fonction de validation (jamais par un membre),
-- et ne change plus ensuite.
create or replace function private.protect_customer_decision()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (new.customer_duplicate_decision, new.customer_decided_at) is distinct from (old.customer_duplicate_decision, old.customer_decided_at) then
    if current_user in ('authenticated', 'anon') then
      raise exception 'Customer decisions can only be recorded by the customer' using errcode = '42501';
    end if;
    if old.customer_duplicate_decision is not null then
      raise exception 'A customer decision cannot be changed' using errcode = '55000';
    end if;
  end if;
  return new;
end;
$$;
create trigger inventory_items_protect_customer_decision
  before update on public.inventory_items
  for each row execute function private.protect_customer_decision();

-- -----------------------------------------------------------------------------
-- Historique des corrections : auteur (client, déménageur, système)
-- -----------------------------------------------------------------------------
alter table public.inventory_item_changes
  add column actor text not null default 'mover' check (actor in ('mover', 'customer', 'system'));
alter table public.inventory_item_changes drop constraint inventory_item_changes_action_check;
alter table public.inventory_item_changes add constraint inventory_item_changes_action_check
  check (action in ('add', 'update', 'remove', 'restore', 'merge', 'confirm', 'customer_decision', 'duplicate_decision'));

drop policy "inventory_item_changes: ajout par les membres" on public.inventory_item_changes;
create policy "inventory_item_changes: ajout par les membres" on public.inventory_item_changes
  for insert to authenticated
  with check (company_id in (select private.user_company_ids()) and changed_by = (select auth.uid()) and actor = 'mover');

-- -----------------------------------------------------------------------------
-- Vérifications par le déménageur (trace immuable)
-- -----------------------------------------------------------------------------
create table public.inventory_verifications (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null,
  company_id uuid not null,
  outcome text not null check (outcome in ('confirmed', 'corrected_same_terms', 'corrected_new_version', 'corrected_amendment')),
  reason text check (char_length(reason) <= 1000),
  changes jsonb not null default '[]'::jsonb check (jsonb_typeof(changes) = 'array'),
  volume_before_m3 numeric(9, 3),
  volume_after_m3 numeric(9, 3),
  total_before_cents bigint,
  total_after_cents bigint,
  quote_before_id uuid,
  quote_after_id uuid,
  verified_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  check (outcome = 'confirmed' or reason is not null),
  foreign key (request_id, company_id) references public.quote_requests (id, company_id) on delete cascade,
  foreign key (quote_before_id, request_id) references public.quotes (id, request_id),
  foreign key (quote_after_id, request_id) references public.quotes (id, request_id)
);
create index inventory_verifications_request_idx on public.inventory_verifications (request_id, created_at desc);
create index inventory_verifications_company_idx on public.inventory_verifications (company_id);
comment on table public.inventory_verifications is
  'Chaque vérification du déménageur : confirmation des décisions du client, ou corrections (même devis, nouvelle version, avenant). Jamais modifiée ni supprimée.';

alter table public.inventory_verifications enable row level security;
revoke all on public.inventory_verifications from anon, authenticated;
grant select, insert on public.inventory_verifications to authenticated;
create policy "inventory_verifications: lecture par les membres" on public.inventory_verifications
  for select to authenticated using (company_id in (select private.user_company_ids()));
create policy "inventory_verifications: ajout par les membres" on public.inventory_verifications
  for insert to authenticated
  with check (company_id in (select private.user_company_ids()) and verified_by = (select auth.uid()));

-- -----------------------------------------------------------------------------
-- E-mails aux clients : préparés et conservés ; envoyés seulement quand un service
-- d'e-mail sera configuré (statut not_configured d'ici là, jamais simulé).
-- -----------------------------------------------------------------------------
create table public.customer_notifications (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null,
  company_id uuid not null,
  verification_id uuid references public.inventory_verifications (id) on delete set null,
  kind text not null check (kind in ('inventory_corrected')),
  to_email text check (char_length(to_email) <= 320),
  subject text not null check (char_length(subject) <= 300),
  body_text text not null check (char_length(body_text) <= 20000),
  status text not null default 'not_configured' check (status in ('not_configured', 'no_recipient', 'queued', 'sent', 'failed')),
  provider_message_id text,
  error text check (char_length(error) <= 2000),
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  foreign key (request_id, company_id) references public.quote_requests (id, company_id) on delete cascade
);
create index customer_notifications_request_idx on public.customer_notifications (request_id, created_at desc);
create index customer_notifications_company_idx on public.customer_notifications (company_id);
comment on table public.customer_notifications is
  'E-mails destinés aux clients. Statut not_configured : aucun service d''e-mail n''est configuré, le message est conservé mais N''A PAS été envoyé.';

alter table public.customer_notifications enable row level security;
revoke all on public.customer_notifications from anon, authenticated;
grant select, insert on public.customer_notifications to authenticated;
create policy "customer_notifications: lecture par les membres" on public.customer_notifications
  for select to authenticated using (company_id in (select private.user_company_ids()));
create policy "customer_notifications: ajout par les membres" on public.customer_notifications
  for insert to authenticated
  with check (company_id in (select private.user_company_ids()) and status in ('not_configured', 'no_recipient'));

-- -----------------------------------------------------------------------------
-- Devis : origines nouvelles et avenants à un devis accepté
-- -----------------------------------------------------------------------------
alter table public.quotes drop constraint quotes_origin_check;
alter table public.quotes add constraint quotes_origin_check
  check (origin in ('automatic', 'correction', 'manual', 'customer_validation', 'verification'));
alter table public.quotes
  add column amends_quote_id uuid,
  add constraint quotes_amends_fk foreign key (amends_quote_id, request_id) references public.quotes (id, request_id);
comment on column public.quotes.amends_quote_id is
  'Avenant : devis accepté que cette version propose de modifier. Le devis accepté reste inchangé et en vigueur tant que l''avenant n''est pas accepté.';

-- L'avenant fait partie de la version figée.
create or replace function private.freeze_quote()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (new.lines, new.total_ht, new.vat_rate, new.vat_amount, new.total_ttc, new.total_ht_cents, new.vat_cents, new.total_ttc_cents,
      new.version, new.kind, new.origin, new.pricing_snapshot, new.volume_snapshot, new.company_snapshot, new.request_snapshot,
      new.inventory_snapshot, new.assumptions, new.review_reasons, new.valid_until, new.request_id, new.supersedes_id,
      new.amends_quote_id, new.changes_summary, new.created_at)
     is distinct from
     (old.lines, old.total_ht, old.vat_rate, old.vat_amount, old.total_ttc, old.total_ht_cents, old.vat_cents, old.total_ttc_cents,
      old.version, old.kind, old.origin, old.pricing_snapshot, old.volume_snapshot, old.company_snapshot, old.request_snapshot,
      old.inventory_snapshot, old.assumptions, old.review_reasons, old.valid_until, old.request_id, old.supersedes_id,
      old.amends_quote_id, old.changes_summary, old.created_at) then
    raise exception 'A quote version cannot be modified; create a new version' using errcode = '55000';
  end if;
  if old.status = 'accepted' and new.status <> 'accepted' then
    raise exception 'An accepted quote cannot change status' using errcode = '55000';
  end if;
  return new;
end;
$$;

-- Après une acceptation, seule une version qui se présente comme AVENANT du dernier devis accepté
-- peut être créée ; elle n'est jamais acceptée d'office.
create or replace function private.forbid_quote_after_acceptance()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  last_accepted uuid;
begin
  select q.id into last_accepted from public.quotes q
   where q.request_id = new.request_id and q.status = 'accepted'
   order by q.version desc limit 1;
  if last_accepted is not null then
    if new.amends_quote_id is distinct from last_accepted then
      raise exception 'A quote has been accepted for this request; only an amendment can be proposed' using errcode = '55000';
    end if;
    if new.status = 'accepted' then
      raise exception 'An amendment must be explicitly accepted by the customer' using errcode = '55000';
    end if;
  elsif new.amends_quote_id is not null then
    raise exception 'Only an accepted quote can be amended' using errcode = '55000';
  end if;
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Accès du particulier : inventaire à valider
-- -----------------------------------------------------------------------------
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
    'customer_validated_at', req.customer_validated_at,
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', i.id,
        'name', i.name,
        'room', coalesce(r.name, 'Autre'),
        'room_position', coalesce(r.position, 999),
        'quantity', i.quantity,
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
      ) order by coalesce(r.position, 999), i.name)
      from public.inventory_items i
      left join public.rooms r on r.id = i.room_id
      where i.request_id = req.id and not i.removed and i.merged_into_item_id is null
    ), '[]'::jsonb)
  );
end;
$$;

-- Validation de l'inventaire : TOUS les doublons possibles doivent avoir une réponse, et l'avertissement
-- doit avoir été accepté. Les réponses sont enregistrées (historique « client ») et ne changent plus.
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
  if acknowledgement is null or char_length(trim(acknowledgement)) < 20 or char_length(acknowledgement) > 2000 then
    raise exception 'The warning must be acknowledged' using errcode = '22023';
  end if;
  if decisions is null or jsonb_typeof(decisions) <> 'object' then
    raise exception 'Invalid decisions' using errcode = '22023';
  end if;
  -- Aucune réponse pour un objet qui n'est pas un doublon possible de cette demande.
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

-- Réponse du particulier : refuser un AVENANT laisse le devis accepté en vigueur.
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
    if q.amends_quote_id is null then
      update public.quote_requests set status = 'refused' where id = req.id;
    end if;
  end if;
  return decision;
end;
$$;

-- Suivi du particulier : validation, avenants et corrections du déménageur (jamais une simple confirmation).
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
                 'valid_until', q.valid_until, 'lines', q.lines, 'total_ht_cents', q.total_ht_cents, 'vat_cents', q.vat_cents,
                 'total_ttc_cents', q.total_ttc_cents, 'vat_rate', q.vat_rate, 'distance_km', q.distance_km,
                 'distance_method', q.distance_method, 'volume', q.volume_snapshot, 'company', q.company_snapshot,
                 'request', q.request_snapshot, 'inventory', q.inventory_snapshot, 'assumptions', q.assumptions,
                 'review_reasons', q.review_reasons, 'changes', q.changes_summary, 'sent_at', q.sent_at, 'accepted_at', q.accepted_at,
                 'refused_at', q.refused_at, 'amends_quote_id', q.amends_quote_id, 'supersedes_id', q.supersedes_id)
               order by q.version desc)
               from public.quotes q where q.request_id = req.id and q.status <> 'draft'), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.get_public_inventory(text) from public;
revoke all on function public.validate_public_inventory(text, jsonb, text) from public;
grant execute on function public.get_public_inventory(text) to anon, authenticated, service_role;
grant execute on function public.validate_public_inventory(text, jsonb, text) to anon, authenticated, service_role;
