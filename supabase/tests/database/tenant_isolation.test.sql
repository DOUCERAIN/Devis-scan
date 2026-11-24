-- =============================================================================
-- Tests d'isolation multi-entreprises (pgTAP).
-- Lancer : npm run test:db   (nécessite Supabase local : npm run db:start)
--
-- Scénario : deux entreprises A et B.
--   alice : propriétaire de A     bob : propriétaire de B
--   anna  : simple membre de A    (et un visiteur anonyme)
-- Chaque test vérifie qu'une entreprise ne peut ni lire, ni créer, ni modifier,
-- ni supprimer les données de l'autre, y compris dans le stockage.
-- =============================================================================
begin;
create extension if not exists pgtap with schema extensions;
select plan(53);

-- ---------------------------------------------------------------------------
-- Préparation (en super-utilisateur)
-- ---------------------------------------------------------------------------
insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at)
values
  ('a1a1a1a1-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'alice@test.local', '{"full_name":"Alice A"}', now(), now()),
  ('a2a2a2a2-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'anna@test.local', '{"full_name":"Anna A"}', now(), now()),
  ('b1b1b1b1-0000-4000-8000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'bob@test.local', '{"full_name":"Bob B"}', now(), now());

create function pg_temp.login(uid uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.logout() returns void language sql as $$
  select set_config('role', 'postgres', true), set_config('request.jwt.claims', '', true);
$$;
create function pg_temp.anon() returns void language sql as $$
  select set_config('role', 'anon', true), set_config('request.jwt.claims', '{"role":"anon"}', true);
$$;

select is((select full_name from public.profiles where id = 'a1a1a1a1-0000-4000-8000-000000000001'), 'Alice A',
  'Un profil est créé automatiquement à l''inscription');

-- ---------------------------------------------------------------------------
-- Création des entreprises
-- ---------------------------------------------------------------------------
select pg_temp.login('a1a1a1a1-0000-4000-8000-000000000001');
select lives_ok($$ select public.create_company('Déménagements Alpha') $$, 'Alice crée son entreprise');
select throws_ok($$ select public.create_company('Deuxième entreprise') $$, '23505', null,
  'Un compte ne peut pas créer une deuxième entreprise');
select throws_ok($$ insert into public.companies (name, slug) values ('Pirate', 'pirate') $$, '42501', null,
  'Insertion directe dans companies interdite');

select pg_temp.login('b1b1b1b1-0000-4000-8000-000000000003');
select lives_ok($$ select public.create_company('Transports Bravo') $$, 'Bob crée son entreprise');

select pg_temp.logout();
-- Identifiants récupérés par utilisateur (indépendant des données déjà présentes en base).
create temp table ids as
  select (select company_id from public.company_members where user_id = 'a1a1a1a1-0000-4000-8000-000000000001') as company_a,
         (select company_id from public.company_members where user_id = 'b1b1b1b1-0000-4000-8000-000000000003') as company_b;
grant select on ids to authenticated, anon;

select is((select role::text from public.company_members m, ids where m.company_id = ids.company_a
           and m.user_id = 'a1a1a1a1-0000-4000-8000-000000000001'), 'owner', 'Alice est propriétaire de A');
select is((select count(*)::int from public.pricing_settings p, ids where p.company_id = ids.company_a), 1,
  'La grille tarifaire est créée avec l''entreprise');
select is((select count(*)::int from public.pricing_options p, ids where p.company_id = ids.company_a), 2,
  'Les options par défaut sont créées');

-- Anna devient simple membre de A (ajout par la propriétaire)
select pg_temp.login('a1a1a1a1-0000-4000-8000-000000000001');
select lives_ok($$ insert into public.company_members (company_id, user_id, role)
  select company_a, 'a2a2a2a2-0000-4000-8000-000000000002', 'member' from ids $$, 'La propriétaire ajoute un membre');

-- ---------------------------------------------------------------------------
-- Entreprises et membres
-- ---------------------------------------------------------------------------
select is((select count(*)::int from public.companies), 1, 'Alice ne voit que son entreprise');
select is((select count(*)::int from public.companies c, ids where c.id = ids.company_b), 0, 'Alice ne voit pas B');

update public.companies set name = 'Piraté' where id = (select company_b from ids);
select pg_temp.logout();
select is((select name from public.companies c, ids where c.id = ids.company_b), 'Transports Bravo',
  'Alice ne peut pas modifier B');

select pg_temp.login('a1a1a1a1-0000-4000-8000-000000000001');
select lives_ok($$ update public.companies set name = 'Alpha Déménagement', next_request_number = 999, is_demo = true
  where id = (select company_a from ids) $$, 'Alice modifie son entreprise');
select pg_temp.logout();
select results_eq($$ select name, next_request_number, is_demo from public.companies c, ids where c.id = ids.company_a $$,
  $$ values ('Alpha Déménagement'::text, 1, false) $$, 'Les champs système sont protégés');

select pg_temp.login('a1a1a1a1-0000-4000-8000-000000000001');
select throws_ok($$ insert into public.company_members (company_id, user_id, role)
  select company_b, 'a1a1a1a1-0000-4000-8000-000000000001', 'owner' from ids $$, '42501', null,
  'Alice ne peut pas s''ajouter à B');
select throws_ok($$ delete from public.company_members where user_id = 'a1a1a1a1-0000-4000-8000-000000000001' $$, '23514', null,
  'Le dernier propriétaire ne peut pas quitter son entreprise');
select is((select count(*)::int from public.company_members), 2, 'Alice voit les 2 membres de A seulement');
select is((select count(*)::int from public.profiles), 2, 'Alice voit son profil et celui d''Anna, pas celui de Bob');

-- ---------------------------------------------------------------------------
-- Rôles : un simple membre ne modifie ni l'entreprise ni les tarifs
-- ---------------------------------------------------------------------------
select pg_temp.login('a2a2a2a2-0000-4000-8000-000000000002');
update public.companies set name = 'Par Anna' where id = (select company_a from ids);
update public.pricing_settings set price_per_m3 = 1 where company_id = (select company_a from ids);
select throws_ok($$ insert into public.pricing_options (company_id, name, price) select company_a, 'Option Anna', 10 from ids $$,
  '42501', null, 'Un membre ne crée pas d''option tarifaire');
select throws_ok($$ select public.create_company('Anna Corp') $$, '23505', null,
  'Un membre déjà rattaché ne crée pas d''autre entreprise');
select pg_temp.logout();
select is((select name from public.companies c, ids where c.id = ids.company_a), 'Alpha Déménagement',
  'Un membre ne renomme pas l''entreprise');
select is((select price_per_m3 from public.pricing_settings p, ids where p.company_id = ids.company_a), 85.00::numeric,
  'Un membre ne modifie pas les tarifs');

-- ---------------------------------------------------------------------------
-- Demandes de devis et données liées
-- ---------------------------------------------------------------------------
select pg_temp.login('a1a1a1a1-0000-4000-8000-000000000001');
insert into public.customers (company_id, full_name, email) select company_a, 'Claire Client', 'claire@example.com' from ids;
insert into public.quote_requests (company_id, customer_id, source)
  select company_a, (select id from public.customers limit 1), 'mover_manual' from ids;
insert into public.dwellings (request_id, company_id, kind, city, floor, elevator)
  select (select id from public.quote_requests limit 1), company_a, 'origin', 'Lyon', 4, 'none' from ids;
insert into public.rooms (request_id, company_id, name)
  select (select id from public.quote_requests limit 1), company_a, 'Chambre' from ids;
insert into public.inventory_items (request_id, company_id, room_id, name, unit_volume_m3, source)
  select (select id from public.quote_requests limit 1), company_a, (select id from public.rooms limit 1), 'Lit double', 1.4, 'mover' from ids;
select is((select request_number from public.quote_requests limit 1), 1, 'La première demande de A porte le numéro 1');
select is((select count(*)::int from public.request_events where event_type = 'created'), 1,
  'La création de la demande est historisée');
select throws_ok($$ insert into public.quote_requests (company_id) select company_b from ids $$, '42501', null,
  'Alice ne crée pas de demande pour B');
select throws_ok($$ update public.quote_requests set company_id = (select company_b from ids) $$, '42501', null,
  'Une demande ne change pas d''entreprise');

select pg_temp.login('a2a2a2a2-0000-4000-8000-000000000002');
select lives_ok($$ update public.quote_requests set status = 'to_review' $$, 'Un membre fait avancer une demande');
delete from public.quote_requests;
select is((select count(*)::int from public.quote_requests), 1, 'Un membre ne supprime pas de demande');
select is((select count(*)::int from public.request_events where event_type = 'status_changed'), 1,
  'Le changement de statut est historisé');
select throws_ok($$ insert into public.request_events (request_id, company_id, event_type, to_status, actor_user_id)
  select id, company_id, 'status_changed', 'accepted', 'a2a2a2a2-0000-4000-8000-000000000002' from public.quote_requests $$,
  '42501', null, 'L''historique ne se falsifie pas');

select pg_temp.login('b1b1b1b1-0000-4000-8000-000000000003');
insert into public.quote_requests (company_id) select company_b from ids;
select is((select request_number from public.quote_requests), 1, 'B a sa propre numérotation');
select is((select count(*)::int from public.quote_requests), 1, 'Bob ne voit que la demande de B');
select is((select count(*)::int from public.customers), 0, 'Bob ne voit pas les clients de A');
select is((select count(*)::int from public.dwellings), 0, 'Bob ne voit pas les logements de A');
select is((select count(*)::int from public.rooms), 0, 'Bob ne voit pas les pièces de A');
select is((select count(*)::int from public.inventory_items), 0, 'Bob ne voit pas l''inventaire de A');
select is((select count(*)::int from public.request_events), 1, 'Bob ne voit que l''historique de B');
select is((select count(*)::int from public.pricing_options), 2, 'Bob ne voit que ses propres options');

update public.quote_requests set status = 'cancelled' where company_id = (select company_a from ids);
delete from public.inventory_items;
select pg_temp.logout();
select is((select status::text from public.quote_requests q, ids where q.company_id = ids.company_a), 'to_review',
  'Bob ne modifie pas une demande de A');
select is((select count(*)::int from public.inventory_items i, ids where i.company_id = ids.company_a), 1, 'Bob ne supprime pas l''inventaire de A');

-- Rattacher une donnée de B à une demande de A est impossible (contrainte d'intégrité)
create temp table a_request as select id from public.quote_requests q where q.company_id = (select company_a from ids);
grant select on a_request to authenticated;
select pg_temp.login('b1b1b1b1-0000-4000-8000-000000000003');
select throws_ok($$ insert into public.dwellings (request_id, company_id, kind)
  select (select id from a_request), company_b, 'destination' from ids $$, '23503', null,
  'Bob ne rattache pas un logement à une demande de A');
select throws_ok($$ insert into public.rooms (request_id, company_id, name)
  select (select id from a_request), company_a, 'Intrusion' from ids $$, '42501', null,
  'Bob n''écrit pas dans A même en se faisant passer pour A');

-- Données produites par le système : lecture seule
select throws_ok($$ insert into public.analysis_runs (request_id, company_id) select id, company_id from public.quote_requests $$,
  '42501', null, 'Un utilisateur ne crée pas d''analyse IA lui-même');

-- ---------------------------------------------------------------------------
-- Visiteur anonyme : aucun accès direct
-- ---------------------------------------------------------------------------
select pg_temp.anon();
select throws_ok($$ select count(*) from public.companies $$, '42501', null, 'Anonyme : pas d''accès aux entreprises');
select throws_ok($$ select count(*) from public.quote_requests $$, '42501', null, 'Anonyme : pas d''accès aux demandes');
select throws_ok($$ select public.create_company('Anonyme SA') $$, '42501', null, 'Anonyme : pas de création d''entreprise');

-- ---------------------------------------------------------------------------
-- Stockage
-- ---------------------------------------------------------------------------
select pg_temp.logout();
insert into storage.objects (bucket_id, name, owner_id)
select 'request-media', company_a || '/' || (select id from a_request) || '/videos/v1.mp4', null from ids
union all
select 'request-media', company_b || '/x/videos/v2.mp4', null from ids;

select pg_temp.login('a1a1a1a1-0000-4000-8000-000000000001');
select is((select count(*)::int from storage.objects where bucket_id = 'request-media'), 1,
  'Alice ne voit que les vidéos de A');
select throws_ok($$ insert into storage.objects (bucket_id, name) select 'request-media', company_a || '/y/videos/v3.mp4' from ids $$,
  '42501', null, 'Aucun envoi direct dans le stockage privé');
select lives_ok($$ insert into storage.objects (bucket_id, name) select 'company-assets', company_a || '/logo.png' from ids $$,
  'Alice dépose le logo de A');
select throws_ok($$ insert into storage.objects (bucket_id, name) select 'company-assets', company_b || '/logo.png' from ids $$,
  '42501', null, 'Alice ne dépose pas de logo pour B');

select pg_temp.login('a2a2a2a2-0000-4000-8000-000000000002');
select throws_ok($$ insert into storage.objects (bucket_id, name) select 'company-assets', company_a || '/logo2.png' from ids $$,
  '42501', null, 'Un simple membre ne change pas le logo');

select pg_temp.login('b1b1b1b1-0000-4000-8000-000000000003');
select is((select count(*)::int from storage.objects where bucket_id = 'request-media'), 1,
  'Bob ne voit que les vidéos de B');
-- Le stockage bloque les suppressions SQL directes ; on l'autorise ici pour tester la règle RLS.
select set_config('storage.allow_delete_query', 'true', true);
delete from storage.objects where bucket_id = 'company-assets';
select pg_temp.logout();
select is((select count(*)::int from storage.objects o, ids where o.bucket_id = 'company-assets' and o.name = ids.company_a || '/logo.png'), 1,
  'Bob ne supprime pas le logo de A');

select * from finish();
rollback;
