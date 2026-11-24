-- =============================================================================
-- Tests du parcours particulier sans compte (pgTAP).
-- Vérifie : jeton secret obligatoire, limites, impossibilité d'agir sur la
-- demande d'un autre, demande verrouillée après envoi, fonctions serveur
-- interdites aux visiteurs, et visibilité limitée à l'entreprise concernée.
-- =============================================================================
begin;
create extension if not exists pgtap with schema extensions;
select plan(25);

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at)
values
  ('c1c1c1c1-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'carole@test.local', '{}', now(), now()),
  ('d1d1d1d1-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'denis@test.local', '{}', now(), now());

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

select pg_temp.login('c1c1c1c1-0000-4000-8000-000000000001');
select public.create_company('Carole Déménagement Test');
select pg_temp.login('d1d1d1d1-0000-4000-8000-000000000002');
select public.create_company('Denis Transport Test');
select pg_temp.reset();

create temp table ctx as
  select (select c.slug from public.companies c join public.company_members m on m.company_id = c.id
          where m.user_id = 'c1c1c1c1-0000-4000-8000-000000000001') as slug_c,
         (select company_id from public.company_members where user_id = 'c1c1c1c1-0000-4000-8000-000000000001') as company_c;
grant select on ctx to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
select pg_temp.anon();
select is((select name from public.get_public_company((select slug_c from ctx))), 'Carole Déménagement Test',
  'Un visiteur lit les informations publiques de l''entreprise');
select is((select count(*)::int from public.get_public_company('inconnue-xyz')), 0, 'Entreprise inconnue : aucun résultat');

select throws_ok($$ select * from public.create_public_request((select slug_c from ctx),
  '{"customer":{"full_name":"Paul"},"origin":{"city":"Lyon"}}') $$, '22023', null, 'E-mail obligatoire pour le particulier');
select throws_ok($$ select * from public.create_public_request('inconnue-xyz',
  '{"customer":{"full_name":"Paul","email":"paul@example.com"},"origin":{"city":"Lyon"}}') $$, '22023', null, 'Entreprise inconnue refusée');

create temp table t1 as
  select * from public.create_public_request((select slug_c from ctx),
    '{"customer":{"full_name":"Paul Client","email":"Paul@Example.com"},"origin":{"city":"Lyon","floor":"3","elevator":"none"},"destination":{"city":"Bron"}}');
select ok((select access_token ~ '^[0-9a-f]{64}$' from t1), 'Un jeton secret de 64 caractères est remis au particulier');

select throws_ok($$ select count(*) from public.quote_requests $$, '42501', null, 'Le visiteur ne lit toujours pas les tables');

create temp table r1 as select public.add_public_room((select access_token from t1), 'Salon', 'living') as room_id;
select ok((select room_id is not null from r1), 'Ajout d''une pièce avec le jeton');
select throws_ok($$ select public.add_public_room(repeat('0', 64), 'Salon') $$, '42501', null, 'Jeton inconnu refusé');
select throws_ok($$ select public.add_public_room('pas-un-jeton', 'Salon') $$, '42501', null, 'Jeton mal formé refusé');

select throws_ok($$ select * from public.register_public_video((select access_token from t1), (select room_id from r1), 'video/avi', 1000) $$,
  '22023', null, 'Format vidéo non accepté');
select throws_ok($$ select * from public.register_public_video((select access_token from t1), (select room_id from r1), 'video/mp4', 60 * 1024 * 1024) $$,
  '22023', null, 'Vidéo trop lourde refusée');
create temp table v1 as select * from public.register_public_video((select access_token from t1), (select room_id from r1), 'video/mp4', 1000);
select ok((select storage_path = (select company_c from ctx) || '/' || (select request_id from t1) || '/videos/' || video_id || '.mp4' from v1),
  'Emplacement de la vidéo rangé dans le dossier de l''entreprise et de la demande');

-- Deuxième demande : son jeton ne donne pas accès aux pièces de la première
create temp table t2 as
  select * from public.create_public_request((select slug_c from ctx),
    '{"customer":{"full_name":"Intrus","email":"intrus@example.com"},"origin":{"city":"Paris"}}');
select throws_ok($$ select * from public.register_public_video((select access_token from t2), (select room_id from r1), 'video/mp4', 1000) $$,
  '22023', null, 'Impossible d''ajouter une vidéo à la pièce d''une autre demande');
select throws_ok($$ select public.remove_public_room((select access_token from t2), (select room_id from r1)) $$,
  '22023', null, 'Impossible de supprimer la pièce d''une autre demande');

select throws_ok($$ select public.submit_public_request((select access_token from t1)) $$, '22023', null,
  'Envoi refusé tant qu''aucune vidéo n''est réellement envoyée');
select throws_ok($$ select public.mark_video_uploaded((select access_token from t1), (select video_id from v1), 1000) $$, '42501', null,
  'Le visiteur ne peut pas déclarer lui-même une vidéo envoyée');

-- Le serveur confirme l'envoi (après vérification du fichier dans le stockage)
select pg_temp.reset();
grant select on t1, t2, r1, v1 to anon, authenticated, service_role;
select pg_temp.service();
select throws_ok($$ select public.mark_video_uploaded((select access_token from t2), (select video_id from v1), 2048) $$, '22023', null,
  'Le jeton d''une autre demande ne confirme pas cette vidéo');
select lives_ok($$ select public.mark_video_uploaded((select access_token from t1), (select video_id from v1), 2048, 42.5) $$, 'Le serveur confirme l''envoi');
select pg_temp.reset();
select ok((select delete_after between now() + interval '89 days' and now() + interval '91 days' from public.room_videos where id = (select video_id from v1)),
  'Date de suppression fixée selon la durée de conservation de l''entreprise (90 jours)');

select pg_temp.anon();
select lives_ok($$ select public.submit_public_request((select access_token from t1)) $$, 'Le particulier envoie sa demande');
select throws_ok($$ select public.add_public_room((select access_token from t1), 'Cave') $$, '55000', null,
  'Une demande envoyée ne se modifie plus');
select is((select public.get_public_request((select access_token from t1)) ->> 'status'), 'submitted',
  'Le particulier peut consulter l''état de sa demande');

-- Visibilité côté entreprises
select pg_temp.login('c1c1c1c1-0000-4000-8000-000000000001');
select is((select count(*)::int from public.quote_requests where status = 'submitted'), 1, 'L''entreprise concernée voit la demande envoyée');
select pg_temp.login('d1d1d1d1-0000-4000-8000-000000000002');
select is((select count(*)::int from public.quote_requests), 0, 'L''autre entreprise ne voit rien');

-- Purge RGPD : réservée au serveur
select pg_temp.anon();
select throws_ok($$ select * from public.claim_videos_for_purge(10) $$, '42501', null, 'La purge est réservée au serveur');

select * from finish();
rollback;
