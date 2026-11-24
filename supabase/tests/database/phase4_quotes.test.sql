-- =============================================================================
-- Tests phase 4 (pgTAP) : catalogue, grille « enregistrée », options du client,
-- lien de consultation, devis figés et versionnés, réponse du client, isolation.
-- =============================================================================
begin;
create extension if not exists pgtap with schema extensions;
select plan(24);

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at)
values
  ('a4a4a4a4-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'anna4@test.local', '{}', now(), now()),
  ('b4b4b4b4-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'bruno4@test.local', '{}', now(), now());

create function pg_temp.login(uid uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.anon() returns void language sql as $$
  select set_config('role', 'anon', true), set_config('request.jwt.claims', '{"role":"anon"}', true);
$$;
create function pg_temp.reset() returns void language sql as $$
  select set_config('role', 'postgres', true), set_config('request.jwt.claims', '', true);
$$;

select pg_temp.login('a4a4a4a4-0000-4000-8000-000000000001');
select public.create_company('Anna Déménagement Quatre');
select pg_temp.login('b4b4b4b4-0000-4000-8000-000000000002');
select public.create_company('Bruno Transport Quatre');
select pg_temp.reset();

create temp table ctx as
  select (select c.slug from public.companies c join public.company_members m on m.company_id = c.id where m.user_id = 'a4a4a4a4-0000-4000-8000-000000000001') as slug_a,
         (select company_id from public.company_members where user_id = 'a4a4a4a4-0000-4000-8000-000000000001') as company_a,
         (select company_id from public.company_members where user_id = 'b4b4b4b4-0000-4000-8000-000000000002') as company_b;
grant select on ctx to anon, authenticated;

-- Catalogue ------------------------------------------------------------------
select pg_temp.anon();
select ok((select count(*) from public.furniture_catalog) >= 100, 'Catalogue lisible sans compte');
select throws_ok($$ insert into public.furniture_catalog (id, name, category, category_label, subcategory, handling, dims_reliability, moving_volume_reliability, method, updated_on)
                    values ('pirate', 'x', 'x', 'x', 'x', 'rigide', 'aucune', 'aucune', 'x', now()) $$, '42501', null, 'Catalogue non modifiable par un visiteur');
select pg_temp.login('a4a4a4a4-0000-4000-8000-000000000001');
select throws_ok($$ update public.furniture_catalog set moving_volume_avg = 99 where id = 'canape-3-places' $$, '42501', null, 'Catalogue non modifiable par un déménageur');

-- Grille « enregistrée » -----------------------------------------------------------
select is((select configured_at from public.pricing_settings where company_id = (select company_a from ctx)), null, 'Grille par défaut : jamais enregistrée');
update public.pricing_settings set price_per_m3 = 70 where company_id = (select company_a from ctx);
select isnt((select configured_at from public.pricing_settings where company_id = (select company_a from ctx)), null, 'Enregistrement par l''entreprise : grille marquée comme configurée');

-- Demande du particulier, options -----------------------------------------------
select pg_temp.anon();
create temp table t as select * from public.create_public_request((select slug_a from ctx), '{
  "customer":{"full_name":"Paul Client","email":"paul@example.com"},
  "origin":{"city":"Lyon","postal_code":"69001"},"destination":{"city":"Paris","postal_code":"75001"}}');
select pg_temp.reset();
grant select on t to anon, authenticated;
create temp table opts as select
  (select id from public.pricing_options where company_id = (select company_a from ctx) order by position limit 1) as own,
  (select id from public.pricing_options where company_id = (select company_b from ctx) order by position limit 1) as foreign_opt;
grant select on opts to anon;
select pg_temp.anon();
select lives_ok(format($$ select public.set_public_options((select access_token from t), '[{"option_id":"%s","quantity":3}]') $$, (select own from opts)), 'Le client choisit une option de son déménageur');
select is(jsonb_array_length(public.get_public_selected_options((select access_token from t))), 1, 'Option enregistrée');
select throws_ok(format($$ select public.set_public_options((select access_token from t), '[{"option_id":"%s"}]') $$, (select foreign_opt from opts)), '22023', null, 'Option d''une autre entreprise refusée');

-- Envoi : jeton de consultation -------------------------------------------------------
select pg_temp.reset();
insert into public.rooms (request_id, company_id, name) select request_id, (select company_a from ctx), 'Salon' from t;
insert into public.room_videos (request_id, company_id, room_id, storage_path, status)
  select t.request_id, (select company_a from ctx), r.id, 'test/' || t.request_id || '/salon.mp4', 'uploaded' from t join public.rooms r on r.request_id = t.request_id;
select pg_temp.anon();
create temp table v as select public.submit_public_request((select access_token from t)) as view_token;
select pg_temp.reset();
grant select on v to anon, authenticated;
select pg_temp.anon();
select matches((select view_token from v), '^[0-9a-f]{64}$', 'Envoi : jeton de consultation remis au client');
select is(public.get_public_quote_view((select view_token from v)) ->> 'status', 'submitted', 'Le lien de consultation donne accès au suivi');
select ok(not (public.get_public_quote_view((select view_token from v)) ? 'request_id'), 'Aucun identifiant interne exposé');
select throws_ok($$ select public.get_public_quote_view(repeat('0', 64)) $$, '42501', null, 'Faux lien refusé');
select pg_temp.reset();
select is((select view_token_hash from public.quote_requests where id = (select request_id from t)), encode(extensions.digest((select view_token from v), 'sha256'), 'hex'), 'Seul le hachage du jeton est stocké');

-- Une seule analyse active ----------------------------------------------------------
insert into public.analysis_runs (request_id, company_id, status) select request_id, (select company_a from ctx), 'running' from t;
select throws_ok($$ insert into public.analysis_runs (request_id, company_id, status) select request_id, (select company_a from ctx), 'queued' from t $$, '23505', null, 'Une seule analyse en cours par demande (pas de double facturation)');

-- Devis figés -------------------------------------------------------------------------
insert into public.quotes (request_id, company_id, status, version, kind, total_ttc_cents, lines)
  select request_id, (select company_a from ctx), 'generated', 1, 'estimate', 50000, '[]' from t;
select throws_ok($$ update public.quotes set total_ttc_cents = 1 where request_id = (select request_id from t) $$, '55000', null, 'Montant d''une version non modifiable');
select throws_ok($$ insert into public.quotes (request_id, company_id, status, version, total_ttc_cents) select request_id, (select company_a from ctx), 'generated', 1, 1 from t $$, '23505', null, 'Numéro de version unique');
create temp table q1 as select id from public.quotes where request_id = (select request_id from t) and version = 1;
grant select on q1 to anon;
select pg_temp.anon();
select throws_ok($$ select count(*) from public.quotes $$, '42501', null, 'Un visiteur ne lit pas la table des devis');
select pg_temp.reset();
update public.quotes set status = 'superseded' where request_id = (select request_id from t) and version = 1;
insert into public.quotes (request_id, company_id, status, version, kind, total_ttc_cents, lines, sent_at)
  select request_id, (select company_a from ctx), 'sent', 2, 'formal', 60000, '[]', now() from t;
create temp table q as select id from public.quotes where request_id = (select request_id from t) and version = 2;
grant select on q to anon;
select pg_temp.anon();
select throws_ok($$ select public.respond_public_quote((select view_token from v), (select id from q1), 'accepted') $$,
  '55000', null, 'Une estimation non envoyée ne peut pas être acceptée');
select is(public.respond_public_quote((select view_token from v), (select id from q), 'accepted'), 'accepted', 'Le client accepte le devis envoyé');
select pg_temp.reset();
select is((select status::text from public.quote_requests where id = (select request_id from t)), 'accepted', 'Demande acceptée');
select throws_ok($$ update public.quotes set status = 'refused' where id = (select id from q) $$, '55000', null, 'Devis accepté verrouillé');

-- Isolation --------------------------------------------------------------------------
select pg_temp.login('b4b4b4b4-0000-4000-8000-000000000002');
select is((select count(*)::int from public.quotes where request_id = (select request_id from t)), 0, 'Une autre entreprise ne voit pas les devis');
select throws_ok($$ insert into public.inventory_item_changes (request_id, company_id, action, changed_by)
                    select request_id, (select company_a from ctx), 'add', 'b4b4b4b4-0000-4000-8000-000000000002' from t $$, '42501', null,
  'Une autre entreprise ne peut pas écrire dans l''historique');
select pg_temp.login('a4a4a4a4-0000-4000-8000-000000000001');
select throws_ok($$ delete from public.quotes where request_id = (select request_id from t) $$, '42501', null, 'Un devis n''est jamais supprimé');

select * from finish();
rollback;
