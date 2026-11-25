-- =============================================================================
-- Parcours client v2 : brouillon sans coordonnées, profils particulier / entreprise, consentements,
-- dates alternatives multiples, étages obligatoires, inventaire manuel, volumes traçables,
-- envoi avec validation immédiate, modification de l'inventaire après analyse, reprise manuelle.
-- =============================================================================
begin;
create extension if not exists pgtap with schema extensions;
select plan(45);

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at)
values ('a6a6a6a6-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'anna6@test.local', '{}', now(), now()),
       ('b6b6b6b6-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'bruno6@test.local', '{}', now(), now());

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

select pg_temp.login('a6a6a6a6-0000-4000-8000-000000000001');
select public.create_company('Anna Déménagement Six');
select pg_temp.login('b6b6b6b6-0000-4000-8000-000000000002');
select public.create_company('Bruno Transport Six');
select pg_temp.reset();
create temp table ctx as
  select (select c.slug from public.companies c join public.company_members m on m.company_id = c.id where m.user_id = 'a6a6a6a6-0000-4000-8000-000000000001') as slug_a,
         (select company_id from public.company_members where user_id = 'a6a6a6a6-0000-4000-8000-000000000001') as company_a;
grant select on ctx to anon, authenticated;

-- Étape 1 : déménagement, sans coordonnées -------------------------------------------------
select pg_temp.anon();
create temp table t as select * from public.create_public_request((select slug_a from ctx), '{
  "moving_date":"2027-03-15","alternative_moving_dates":["2027-03-20","2027-03-18","2027-03-20"],
  "origin":{"city":"Lyon","postal_code":"69001","floor":0,"elevator":"none","housing_type":"apartment"},
  "destination":{"city":"Paris","postal_code":"75001","floor":3,"elevator":"small","housing_type":"apartment"}}');
select pg_temp.reset();
grant select on t to anon, authenticated;
-- Lecture des objets (rôle propriétaire) pendant les étapes jouées en visiteur anonyme.
create function pg_temp.item(n text) returns public.inventory_items language sql security definer set search_path = '' as $$
  select i.* from public.inventory_items i where i.request_id = (select request_id from pg_temp.t) and (i.name = n or i.catalog_key = n) limit 1;
$$;
create function pg_temp.room_of(n text) returns text language sql security definer set search_path = '' as $$
  select r.name from public.rooms r where r.id = (select (pg_temp.item(n)).room_id);
$$;
select pg_temp.anon();

select is((public.get_public_request((select access_token from t)) -> 'customer'), 'null'::jsonb, 'Brouillon créé sans coordonnées');
select is((public.get_public_request((select access_token from t)) -> 'alternative_moving_dates'), '["2027-03-18","2027-03-20"]'::jsonb,
  'Dates alternatives multiples, triées, sans doublon');
select is((public.get_public_request((select access_token from t)) ->> 'alternative_moving_date'), '2027-03-18', 'Ancienne colonne = première date (compatibilité)');
select lives_ok($$ select public.update_public_request((select access_token from t), '{"alternative_moving_dates":["2027-03-20"]}') $$, 'Une date alternative retirée');
select is((public.get_public_request((select access_token from t)) -> 'alternative_moving_dates'), '["2027-03-20"]'::jsonb, 'Liste mise à jour');
select throws_ok($$ select public.update_public_request((select access_token from t), jsonb_build_object('alternative_moving_dates', (select jsonb_agg('"2027-04-01"'::jsonb) from generate_series(1, 31)))) $$,
  '22023', null, 'Plus de 30 dates refusées');

-- Étape 2 : coordonnées ---------------------------------------------------------------------
select throws_ok($$ select public.update_public_request((select access_token from t), '{"customer":{"type":"individual","first_name":"Léa","last_name":"Martin","email":"lea@example.com","phone":"0612345678"}}') $$,
  '22023', null, 'Consentement au traitement des données obligatoire');
select throws_ok($$ select public.update_public_request((select access_token from t), '{"customer":{"type":"individual","first_name":"Léa","last_name":"Martin","email":"lea@example.com","phone":"","privacy_accepted":true}}') $$,
  '22023', null, 'Téléphone obligatoire');
select throws_ok($$ select public.update_public_request((select access_token from t), '{"customer":{"type":"company","first_name":"Léa","last_name":"Martin","email":"lea@example.com","phone":"0612345678","privacy_accepted":true}}') $$,
  '22023', null, 'Entreprise : nom de l''entreprise obligatoire');
select throws_ok($$ select public.update_public_request((select access_token from t), '{"customer":{"type":"company","company_name":"Acme","first_name":"Léa","last_name":"Martin","email":"lea@example.com","phone":"0612345678","siret":"123","privacy_accepted":true}}') $$,
  '22023', null, 'SIRET invalide refusé');
select lives_ok($$ select public.update_public_request((select access_token from t), '{"customer":{"type":"company","company_name":"Acme","first_name":"Léa","last_name":"Martin","email":"Lea@Example.com","phone":"06 12 34 56 78","privacy_accepted":true}}') $$,
  'Entreprise sans SIRET acceptée');
select is((public.get_public_request((select access_token from t)) #>> '{customer,company_name}'), 'Acme', 'Nom de l''entreprise enregistré');
select is((public.get_public_request((select access_token from t)) #>> '{customer,siret}'), null, 'SIRET facultatif');
select lives_ok($$ select public.update_public_request((select access_token from t), '{"customer":{"type":"individual","company_name":"Acme","siret":"12345678901234","first_name":"Léa","last_name":"Martin","email":"lea@example.com","phone":"0612345678","privacy_accepted":true,"marketing_consent":false}}') $$,
  'Passage en particulier');
select is((public.get_public_request((select access_token from t)) #>> '{customer,company_name}'), null, 'Particulier : pas de champ entreprise conservé');
select is((public.get_public_request((select access_token from t)) #>> '{customer,full_name}'), 'Léa Martin', 'Nom complet reconstitué');
select is((public.get_public_request((select access_token from t)) #>> '{customer,marketing_consent}'), 'false', 'Offres commerciales non imposées');

-- Étape 3 : méthode ----------------------------------------------------------------------------
select throws_ok($$ select public.public_inventory_add((select access_token from t), '{"catalog_key":"chaise","category":"cuisine"}') $$,
  '55000', null, 'Inventaire manuel impossible avant le choix de la méthode');
select throws_ok($$ select public.update_public_request((select access_token from t), '{"inventory_method":"autre"}') $$, '22023', null, 'Méthode inconnue refusée');
select lives_ok($$ select public.update_public_request((select access_token from t), '{"inventory_method":"manual"}') $$, 'Méthode manuelle choisie');

-- Étape 4 : inventaire manuel ------------------------------------------------------------------
select lives_ok($$ select public.public_inventory_add((select access_token from t), '{"catalog_key":"chaise","category":"cuisine","quantity":4}') $$, 'Objet du catalogue ajouté');
select is((select (pg_temp.item('chaise')).unit_volume_m3), 0.150::numeric(7,3),
  'Volume du catalogue');
select is(pg_temp.room_of('chaise'), 'Cuisine',
  'Rangé dans sa catégorie');
select throws_ok($$ select public.public_inventory_add((select access_token from t), '{"catalog_key":"armoire-3-portes","category":"chambres"}') $$,
  '22023', null, 'Objet sans volume de référence : taille ou dimensions demandées (jamais de volume inventé)');
select lives_ok($$ select public.public_inventory_add((select access_token from t), '{"catalog_key":"armoire-3-portes","category":"chambres","size":"large"}') $$, 'Avec une taille approximative');
select is((select x.volume_source || ' ' || x.unit_volume_m3 from pg_temp.item('armoire-3-portes') x), 'comparable 0.800',
  'Volume d''un objet comparable du catalogue');
select throws_ok($$ select public.public_inventory_add((select access_token from t), '{"label":"","category":"autres","size":"small"}') $$, '22023', null, 'Objet personnalisé : description obligatoire');
select throws_ok($$ select public.public_inventory_add((select access_token from t), '{"label":"Aquarium","category":"autres","width_cm":100,"depth_cm":40}') $$, '22023', null, 'Dimensions incomplètes refusées');
select lives_ok($$ select public.public_inventory_add((select access_token from t), '{"label":"Aquarium","category":"autres","quantity":1,"width_cm":100,"depth_cm":40,"height_cm":50,"comment":"Vide le jour J"}') $$,
  'Objet personnalisé avec dimensions');
select is((select x.volume_source || ' ' || x.unit_volume_m3 || ' ' || x.customer_comment from pg_temp.item('Aquarium') x),
  'dimensions 0.220 Vide le jour J', 'Volume = dimensions × coefficient, commentaire conservé');
select isnt((select (pg_temp.item('Aquarium')).volume_note), null, 'Justification du volume enregistrée');
select throws_ok($$ select public.public_inventory_add((select access_token from t), '{"label":"Vélo","category":"garage_cave","quantity":0,"size":"medium"}') $$, '22023', null, 'Quantité nulle refusée');
select lives_ok($$ select public.public_inventory_update((select access_token from t), (select (pg_temp.item('chaise')).id), 6) $$,
  'Quantité modifiée');
select lives_ok($$ select public.public_inventory_remove((select access_token from t), (select (pg_temp.item('Aquarium')).id)) $$,
  'Objet retiré');
select is((select (pg_temp.item('Aquarium')).removed), true, 'Retiré sans être effacé');
select is(jsonb_array_length(public.get_public_inventory((select access_token from t)) -> 'items'), 2, 'Inventaire du client');
select is(jsonb_array_length(public.get_public_request((select access_token from t)) -> 'rooms'), 0, 'Les catégories ne sont pas des pièces filmées');

-- Isolation : le jeton d'une demande ne donne pas accès aux objets d'une autre
select throws_ok($$ select public.public_inventory_update((select access_token from t), gen_random_uuid(), 2) $$, '22023', null, 'Objet inconnu refusé');
select throws_ok($$ select public.public_inventory_add(repeat('0', 64), '{"label":"x","size":"small"}') $$, '42501', null, 'Faux jeton refusé');

-- Envoi : validation immédiate ----------------------------------------------------------------
select throws_ok($$ select public.submit_public_manual_request((select access_token from t), '') $$, '22023', null, 'Avertissement obligatoire');
create temp table v as select public.submit_public_manual_request((select access_token from t), 'Merci de vérifier attentivement votre inventaire…') as view_token;
select pg_temp.reset();
grant select on v to anon, authenticated;
select is((select status::text || ' ' || verification_status from public.quote_requests where id = (select request_id from t)), 'customer_validated pending',
  'Inventaire validé, vérification du déménageur en attente');
select pg_temp.anon();
select throws_ok($$ select public.public_inventory_add((select view_token from v), '{"label":"Vélo","size":"medium"}') $$, '55000', null, 'Inventaire figé après validation');

-- Après l'analyse : le client corrige l'inventaire de l'IA, modifications tracées --------------
select pg_temp.reset();
update public.quote_requests set status = 'awaiting_customer', customer_validated_at = null where id = (select request_id from t);
select pg_temp.anon();
select lives_ok($$ select public.public_inventory_add((select view_token from v), '{"label":"Vélo","category":"garage_cave","size":"medium"}') $$, 'Objet oublié ajouté après l''analyse');
select pg_temp.reset();
select is((select actor || ' ' || action from public.inventory_item_changes where request_id = (select request_id from t) order by id desc limit 1), 'customer add',
  'Ajout du client tracé');

-- Membre d'une autre entreprise : aucune visibilité
select pg_temp.login('b6b6b6b6-0000-4000-8000-000000000002');
select is((select count(*)::int from public.customers where email = 'lea@example.com'), 0, 'Coordonnées invisibles pour une autre entreprise');
select pg_temp.reset();

select * from finish();
rollback;
