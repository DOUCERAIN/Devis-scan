-- =============================================================================
-- Devis formel automatique (option de l'entreprise) et motifs de validation humaine.
-- =============================================================================
alter table public.companies
  add column auto_formal_quotes boolean not null default false;
comment on column public.companies.auto_formal_quotes is
  'Si vrai, un devis formel est envoyé automatiquement après l''analyse quand toutes les conditions de fiabilité sont réunies ; sinon une estimation et une demande de validation humaine.';

alter table public.quotes
  add column review_reasons jsonb not null default '[]'::jsonb check (jsonb_typeof(review_reasons) = 'array');
comment on column public.quotes.review_reasons is 'Raisons pour lesquelles une validation humaine est nécessaire (vide pour un devis formel automatique).';

-- Les motifs font partie de la version figée.
create or replace function private.freeze_quote()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (new.lines, new.total_ht, new.vat_rate, new.vat_amount, new.total_ttc, new.total_ht_cents, new.vat_cents, new.total_ttc_cents,
      new.version, new.kind, new.origin, new.pricing_snapshot, new.volume_snapshot, new.company_snapshot, new.request_snapshot,
      new.inventory_snapshot, new.assumptions, new.review_reasons, new.valid_until, new.request_id, new.supersedes_id, new.created_at)
     is distinct from
     (old.lines, old.total_ht, old.vat_rate, old.vat_amount, old.total_ttc, old.total_ht_cents, old.vat_cents, old.total_ttc_cents,
      old.version, old.kind, old.origin, old.pricing_snapshot, old.volume_snapshot, old.company_snapshot, old.request_snapshot,
      old.inventory_snapshot, old.assumptions, old.review_reasons, old.valid_until, old.request_id, old.supersedes_id, old.created_at) then
    raise exception 'A quote version cannot be modified; create a new version' using errcode = '55000';
  end if;
  if old.status = 'accepted' and new.status <> 'accepted' then
    raise exception 'An accepted quote cannot change status' using errcode = '55000';
  end if;
  return new;
end;
$$;

-- Aucune nouvelle version ne peut être créée pour une demande dont un devis est accepté.
create or replace function private.forbid_quote_after_acceptance()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if exists (select 1 from public.quotes q where q.request_id = new.request_id and q.status = 'accepted') then
    raise exception 'A quote has been accepted for this request' using errcode = '55000';
  end if;
  return new;
end;
$$;
create trigger quotes_forbid_after_acceptance before insert on public.quotes
  for each row execute function private.forbid_quote_after_acceptance();

-- Le suivi du particulier affiche aussi les motifs de validation.
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
                 'review_reasons', q.review_reasons, 'changes', q.changes_summary, 'sent_at', q.sent_at, 'accepted_at', q.accepted_at)
               order by q.version desc)
               from public.quotes q where q.request_id = req.id and q.status <> 'draft'), '[]'::jsonb)
  );
end;
$$;
