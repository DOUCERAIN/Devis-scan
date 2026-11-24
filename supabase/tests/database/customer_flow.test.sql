-- =============================================================================
-- Tests du parcours particulier, phase 3 (pgTAP) : modification du brouillon,
-- pièces, vidéos (métadonnées, remplacement, abandon), images extraites,
-- brouillons abandonnés, isolation.
-- =============================================================================
begin;
create extension if not exists pgtap with schema extensions;
select plan(29);

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at)
values
  ('e1e1e1e1-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'eve@test.local', '{}', now(), now()),
  ('f1f1f1f1-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'fred@test.local', '{}', now(), now());

create function pg_temp.login(uid uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.anon() returns void language sql as $$
  select set_config('role', 'anon', true), set_config('request.jwt.claims', '{"role":"anon"}', true);
$$;
create function pg_temp.service() returns void language sql as $$
  select set_config('role', 'service_role', true), set_config('request.jwt.claims', '{"role":"service_role"}', true);
$$;
create function pg_temp.reset() returns void language sql as $$
  select set_config('role', 'postgres', true), set_config('request.jwt.claims', '', true);
$$;

select pg_temp.login('e1e1e1e1-0000-4000-8000-000000000001');
select public.create_company('Eve Déménagement Flux');
select pg_temp.login('f1f1f1f1-0000-4000-8000-000000000002');
select public.create_company('Fred Transport Flux');
select pg_temp.reset();

create temp table ctx as
  select (select c.slug from public.companies c join public.company_members m on m.company_id = c.id
          where m.user_id = 'e1e1e1e1-0000-4000-8000-000000000001') as slug_e,
         (select company_id from public.company_members where user_id = 'e1e1e1e1-0000-4000-8000-000000000001') as company_e;
grant select on ctx to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Création et modification du brouillon
-- ---------------------------------------------------------------------------
select pg_temp.anon();
create temp table t as
  select * from public.create_public_request((select slug_e from ctx), '{
    "customer":{"full_name":"Lina Client","email":"lina@example.com","phone":"0600000000"},
    "moving_date":"2027-03-01","alternative_moving_date":"2027-03-08",
    "origin":{"address_line":"8 Boulevard du Port","postal_code":"95000","city":"Cergy","latitude":"49.03","longitude":"2.07"},
    "destination":{"address_line":"1 rue de Paris","postal_code":"69001","city":"Lyon"}}');
select pg_temp.reset();
grant select on t to anon, authenticated, service_role;
select pg_temp.anon();

select is((public.get_public_request((select access_token from t)) ->> 'alternative_moving_date'), '2027-03-08',
  'Date alternative enregistrée');
select is((public.get_public_request((select access_token from t)) #>> '{dwellings,origin,latitude}'), '49.03',
  'Coordonnées GPS de l''adresse enregistrées');

select lives_ok($$ select public.update_public_request((select access_token from t), '{
  "origin":{"housing_type":"apartment","surface_m2":"65","room_count":"3","floor":"4","elevator":"small","carrying_distance_m":"20","access_notes":"Escalier étroit","parking_notes":"Rue piétonne"},
  "destination":{"housing_type":"house","floor":"0","elevator":"none"}}') $$, 'Le particulier décrit ses logements');
select is((public.get_public_request((select access_token from t)) #>> '{dwellings,origin,city}'), 'Cergy',
  'Les champs non envoyés sont conservés (adresse intacte)');
select is((public.get_public_request((select access_token from t)) #>> '{dwellings,origin,surface_m2}'), '65', 'Surface enregistrée');
select is((public.get_public_request((select access_token from t)) #>> '{dwellings,origin,parking_notes}'), 'Rue piétonne', 'Contraintes enregistrées');

select lives_ok($$ select public.update_public_request((select access_token from t),
  '{"customer":{"full_name":"Lina Martin","email":"lina@example.com"},"moving_date":"2027-03-02","alternative_moving_date":""}') $$,
  'Retour en arrière : coordonnées et dates modifiées');
select is((public.get_public_request((select access_token from t)) ->> 'alternative_moving_date'), null, 'Date alternative effacée');
select throws_ok($$ select public.update_public_request((select access_token from t), '{"customer":{"full_name":"","email":"x"}}') $$,
  '22023', null, 'Coordonnées invalides refusées');
select throws_ok($$ select public.update_public_request((select access_token from t), '{"origin":{"city":""}}') $$,
  '22023', null, 'La ville de départ ne peut pas être effacée');

-- ---------------------------------------------------------------------------
-- Pièces
-- ---------------------------------------------------------------------------
create temp table r as select public.add_public_room((select access_token from t), 'Salon', 'living', 'Canapé d''angle') as id;
select pg_temp.reset(); grant select on r to anon, authenticated, service_role; select pg_temp.anon();
select lives_ok($$ select public.update_public_room((select access_token from t), (select id from r), 'Grand salon', 'living', 'Avec piano') $$,
  'Pièce renommée et description modifiée');
select is((public.get_public_request((select access_token from t)) #>> '{rooms,0,description}'), 'Avec piano', 'Description enregistrée');
select throws_ok($$ select public.update_public_room((select access_token from t), (select id from r), repeat('x', 81)) $$,
  '22023', null, 'Nom de pièce trop long refusé');

-- ---------------------------------------------------------------------------
-- Vidéos
-- ---------------------------------------------------------------------------
create temp table v1 as select * from public.register_public_video((select access_token from t), (select id from r), 'video/mp4', 5000000,
  '{"capture_source":"camera","processing":"compressed","encoder":"mediabunny-avc","original_size_bytes":"48000000","original_mime_type":"video/quicktime","original_width":"1920","original_height":"1080","original_duration_seconds":"42.5"}');
create temp table v2 as select * from public.register_public_video((select access_token from t), (select id from r), 'video/mp4', 4000000, '{}');
select pg_temp.reset();
grant select on v1, v2 to anon, authenticated, service_role;
select is((select count(*)::int from public.room_videos where room_id = (select id from r)), 1,
  'Un emplacement non rempli est remplacé par le nouvel envoi');
select pg_temp.service();
select lives_ok($$ select public.mark_video_uploaded((select access_token from t), (select video_id from v2), 4000000, 30.2, 1280, 720) $$,
  'Envoi confirmé avec dimensions');
select pg_temp.reset();
select results_eq($$ select width, height, duration_seconds from public.room_videos where id = (select video_id from v2) $$,
  $$ values (1280, 720, 30.20::numeric) $$, 'Dimensions et durée enregistrées');

-- Images extraites
select pg_temp.service();
select lives_ok(format($f$ select public.add_public_frames((select access_token from t), (select video_id from v2),
  '[{"path":"%s/%s/frames/%s/11111111-1111-4111-8111-111111111111.jpg","captured_at_ms":"1500","width":"1280","height":"720"},
    {"path":"%s/%s/frames/%s/22222222-2222-4222-8222-222222222222.jpg","captured_at_ms":"9000","width":"1280","height":"720"}]') $f$,
  (select company_e from ctx), (select request_id from t), (select video_id from v2),
  (select company_e from ctx), (select request_id from t), (select video_id from v2)), 'Images extraites enregistrées');
select throws_ok(format($f$ select public.add_public_frames((select access_token from t), (select video_id from v2),
  '[{"path":"%s/autre/frames/x/33333333-3333-4333-8333-333333333333.jpg"}]') $f$, (select company_e from ctx)),
  '22023', null, 'Chemin d''image hors du dossier de la vidéo refusé');
select pg_temp.anon();
select throws_ok($$ select public.add_public_frames((select access_token from t), (select video_id from v2), '[]') $$, '42501', null,
  'Un visiteur ne peut pas enregistrer d''images lui-même');
select is((public.get_public_request((select access_token from t)) #>> '{rooms,0,videos,0,frames}'), '2', 'Le résumé compte les images');

-- Refaire la vidéo : l'ancienne est programmée pour suppression immédiate
select lives_ok($$ select public.discard_public_video((select access_token from t), (select video_id from v2)) $$, 'Vidéo supprimée par le particulier');
select is(jsonb_array_length(public.get_public_request((select access_token from t)) #> '{rooms,0,videos}'), 0, 'La vidéo supprimée n''apparaît plus');
select pg_temp.service();
select ok((select count(*) > 0 from public.claim_videos_for_purge(500) where video_id = (select video_id from v2)),
  'La vidéo supprimée est immédiatement proposée à la purge du stockage');

-- ---------------------------------------------------------------------------
-- Isolation : l'autre entreprise ne voit rien
-- ---------------------------------------------------------------------------
select pg_temp.login('f1f1f1f1-0000-4000-8000-000000000002');
select is((select count(*)::int from public.room_videos), 0, 'L''autre entreprise ne voit pas les vidéos');
select is((select count(*)::int from public.video_frames), 0, 'L''autre entreprise ne voit pas les images');
select pg_temp.login('e1e1e1e1-0000-4000-8000-000000000001');
select is((select count(*)::int from public.video_frames), 2, 'L''entreprise concernée voit les images');

-- ---------------------------------------------------------------------------
-- Brouillons abandonnés
-- ---------------------------------------------------------------------------
select pg_temp.reset();
update public.quote_requests set created_at = now() - interval '31 days' where id = (select request_id from t);
select pg_temp.service();
select ok((select count(*) > 0 from public.claim_abandoned_drafts(200) where request_id = (select request_id from t)),
  'Un brouillon de plus de 30 jours est repéré comme abandonné');
select is((select public.delete_abandoned_drafts(array[(select request_id from t)])), 1, 'Le brouillon abandonné est supprimé');
select pg_temp.anon();
select throws_ok($$ select public.claim_abandoned_drafts(10) $$, '42501', null, 'Fonction de nettoyage réservée au serveur');

select * from finish();
rollback;
