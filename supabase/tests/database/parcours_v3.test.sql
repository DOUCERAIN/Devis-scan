-- =============================================================================
-- Parcours client v3 (migration 20261202090000) : médias sans pièce imposée (« Mon logement »), photos,
-- étape des cartons obligatoire, pièces supplémentaires, prix détaillés jamais transmis au client.
-- =============================================================================
begin;
create extension if not exists pgtap with schema extensions;
select plan(30);

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at)
values ('a7a7a7a7-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'anna7@test.local', '{}', now(), now());

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

select pg_temp.login('a7a7a7a7-0000-4000-8000-000000000001');
select public.create_company('Anna Déménagement Sept');
select pg_temp.reset();
create temp table ctx as
  select (select c.slug from public.companies c join public.company_members m on m.company_id = c.id where m.user_id = 'a7a7a7a7-0000-4000-8000-000000000001') as slug_a,
         (select company_id from public.company_members where user_id = 'a7a7a7a7-0000-4000-8000-000000000001') as company_a;
grant select on ctx to anon, authenticated;
insert into public.pricing_options (company_id, name, description, pricing_mode, price) values ((select company_a from ctx), 'Emballage', 'Par nos soins', 'fixed', 37);

select pg_temp.anon();
create temp table t as select * from public.create_public_request((select slug_a from ctx), '{
  "moving_date":"2027-03-15",
  "origin":{"city":"Lyon","postal_code":"69001","floor":0,"elevator":"none","housing_type":"apartment"},
  "destination":{"city":"Paris","postal_code":"75001","floor":3,"elevator":"small","housing_type":"apartment"}}');
select pg_temp.reset();
grant select on t to anon, authenticated;
create function pg_temp.req() returns public.quote_requests language sql security definer set search_path = '' as $$
  select r.* from public.quote_requests r where r.id = (select request_id from pg_temp.t);
$$;
create function pg_temp.room_types() returns text[] language sql security definer set search_path = '' as $$
  select array_agg(r.room_type order by r.position) from public.rooms r where r.request_id = (select request_id from pg_temp.t);
$$;
select pg_temp.anon();

-- 1. Médias : une seule pièce technique « Mon logement », sans découpage imposé ------------------
create temp table m as select public.public_media_room((select access_token from t)) as room_id;
select is(public.public_media_room((select access_token from t)), (select room_id from m), '« Mon logement » créée une seule fois');
select is((select room_types from pg_temp.room_types() as room_types), array['logement'], 'Type de pièce « logement »');

-- 2. Photos -----------------------------------------------------------------------------------
select throws_ok($$ select public.register_public_video((select access_token from t), (select room_id from m), 'image/png', 1000, '{"media_kind":"photo"}') $$,
  '22023', 'Unsupported photo format', 'Photo : JPEG seulement (réencodée dans le navigateur)');
select throws_ok($$ select public.register_public_video((select access_token from t), (select room_id from m), 'image/jpeg', 11 * 1024 * 1024, '{"media_kind":"photo"}') $$,
  '22023', 'Photo too large', 'Photo de plus de 10 Mo refusée');
create temp table p as select * from public.register_public_video((select access_token from t), (select room_id from m), 'image/jpeg', 250000, '{"media_kind":"photo","capture_source":"gallery"}');
select matches((select storage_path from p), '/photos/[0-9a-f-]{36}\.jpg$', 'Chemin de stockage dédié aux photos');
select throws_ok($$ select public.add_public_photo_frame((select access_token from t), (select video_id from p), 1600, 1200) $$,
  '42501', null, 'Image d''analyse d''une photo : réservée au serveur (vérification du fichier)');
select throws_ok($$ select public.add_public_frames((select access_token from t), (select video_id from p), '[]') $$,
  null, null, 'Images extraites : réservées aux vidéos');
select pg_temp.reset();
select lives_ok($$ select public.mark_video_uploaded((select access_token from t), (select video_id from p), 250000) $$, 'Photo confirmée par le serveur');
select lives_ok($$ select public.add_public_photo_frame((select access_token from t), (select video_id from p), 1600, 1200) $$, 'Photo devenue image d''analyse');
select lives_ok($$ select public.add_public_photo_frame((select access_token from t), (select video_id from p), 1600, 1200) $$, 'Sans doublon si rappelée');
select is((select count(*)::int from public.video_frames f where f.video_id = (select video_id from p) and f.storage_path = (select storage_path from p)), 1,
  'Une image d''analyse, même fichier que la photo');
select is((select media_kind from public.room_videos where id = (select video_id from p)), 'photo', 'Média de type photo');
select pg_temp.anon();
select is(((public.get_public_request((select access_token from t)) -> 'rooms') -> 0 -> 'videos' -> 0 ->> 'kind'), 'photo', 'Type du média visible dans le brouillon');
select lives_ok($$ select public.register_public_video((select access_token from t), (select room_id from m), 'video/mp4', 1000000, '{}') $$,
  'Vidéo et photos mélangées dans « Mon logement »');

-- 3. Cartons et pièces de l'inventaire ----------------------------------------------------------
select lives_ok($$ select public.update_public_request((select access_token from t), '{"inventory_method":"manual"}') $$, 'Méthode manuelle');
select is((public.get_public_inventory((select access_token from t)) ->> 'extra_boxes'), null, 'Cartons non renseignés au départ (aucune valeur imposée)');
select throws_ok($$ select public.public_set_extra_boxes((select access_token from t), -1) $$, '22023', null, 'Nombre négatif refusé');
select throws_ok($$ select public.public_set_extra_boxes((select access_token from t), 1000) $$, '22023', null, '999 cartons au plus');
select lives_ok($$ select public.public_set_extra_boxes((select access_token from t), 12) $$, '12 cartons supplémentaires');
select is((select count(*)::int from jsonb_array_elements(public.get_public_inventory((select access_token from t)) -> 'items') e
            where e ->> 'catalog_key' = 'carton-standard' and (e ->> 'quantity')::int = 12 and (e ->> 'unit_volume_m3')::numeric = 0.1), 1,
  'Ligne « Carton standard » × 12, volume du catalogue (0,10 m³) inchangé');
select lives_ok($$ select public.public_set_extra_boxes((select access_token from t), 0) $$, 'Zéro accepté');
select is((public.get_public_inventory((select access_token from t)) ->> 'extra_boxes'), '0', 'Zéro enregistré (réponse donnée)');
select is((select count(*)::int from jsonb_array_elements(public.get_public_inventory((select access_token from t)) -> 'items') e
            where e ->> 'catalog_key' = 'carton-standard'), 0, 'Ligne des cartons retirée à zéro');
select throws_ok($$ select public.public_inventory_add_room((select access_token from t), 'grenier', 'Grenier') $$, '22023', 'Unknown category', 'Type de pièce inconnu refusé');
create temp table r2 as select public.public_inventory_add_room((select access_token from t), 'chambres', 'Chambre 2') as id;
select lives_ok($$ select public.public_inventory_add((select access_token from t), jsonb_build_object('catalog_key', 'lit-simple', 'category', 'chambres', 'room_id', (select id from r2))) $$,
  'Objet ajouté dans la pièce supplémentaire');
select ok((select bool_or(e ->> 'category' = 'chambres:2' and e ->> 'name' = 'Chambre 2') from jsonb_array_elements(public.get_public_inventory((select access_token from t)) -> 'rooms') e),
  'Pièce supplémentaire « Chambre 2 » (inv:chambres:2)');
select lives_ok($$ select public.public_inventory_add((select access_token from t), '{"catalog_key":"refrigerateur","category":"entree"}') $$, 'Pièce « Entrée / couloir » disponible');

-- 4. Prix : jamais transmis au client ------------------------------------------------------------
select is((select array_to_string(p.proargnames, ',') from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname = 'get_public_company_options'), 'company_slug,id,name,description,pricing_mode',
  'Options proposées au client : sans prix');
select pg_temp.reset();
select is(private.client_line('{"code":"option","label":"Emballage","detail":"37,00 € forfait","amount_cents":3700,"unit_price_cents":3700}'),
  '{"code":"option","label":"Emballage","detail":"Forfait"}'::jsonb, 'Ligne d''option côté client : ni montant ni prix unitaire, détail sans prix');
select is(private.client_line('{"code":"volume","label":"Volume","detail":"11,0 m³ × 45,00 €","amount_cents":49500,"quantity":11}') - 'detail',
  '{"code":"volume","label":"Volume"}'::jsonb, 'Ligne de volume côté client : sans montant');

select * from finish();
rollback;
