-- =============================================================================
-- Demandes successives depuis le même appareil : chaque demande est indépendante, les demandes envoyées
-- ne sont jamais modifiées par une nouvelle demande, le marquage « simulation » est réservé au serveur.
-- =============================================================================
begin;
create extension if not exists pgtap with schema extensions;
select plan(10);

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at)
values ('a8a8a8a8-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'anna8@test.local', '{}', now(), now());
select set_config('role', 'authenticated', true), set_config('request.jwt.claims', '{"sub":"a8a8a8a8-0000-4000-8000-000000000001","role":"authenticated"}', true);
select public.create_company('Anna Déménagement Huit');
select set_config('role', 'postgres', true), set_config('request.jwt.claims', '', true);
create temp table ctx as select c.slug from public.companies c join public.company_members m on m.company_id = c.id where m.user_id = 'a8a8a8a8-0000-4000-8000-000000000001';
grant select on ctx to anon;

create function pg_temp.req(token text) returns public.quote_requests language sql security definer set search_path = '' as $$
  select q.* from public.quote_requests q where q.access_token_hash = encode(extensions.digest(token, 'sha256'), 'hex');
$$;
grant execute on function pg_temp.req(text) to anon;

select set_config('role', 'anon', true), set_config('request.jwt.claims', '{"role":"anon"}', true);
create temp table d1 as select * from public.create_public_request((select slug from ctx), '{"moving_date":"2027-03-15","is_test":true,
  "origin":{"city":"Lyon","postal_code":"69001","floor":0,"elevator":"none","housing_type":"apartment"},
  "destination":{"city":"Paris","postal_code":"75001","floor":1,"elevator":"none","housing_type":"apartment"}}');
select lives_ok($$ select public.update_public_request((select access_token from d1), '{"customer":{"type":"individual","first_name":"Léa","last_name":"Martin","email":"lea@example.com","phone":"0612345678","privacy_accepted":true}}') $$,
  'Première demande : coordonnées');
create temp table d2 as select * from public.create_public_request((select slug from ctx), '{"moving_date":"2027-06-01",
  "origin":{"city":"Lyon","postal_code":"69003","floor":2,"elevator":"none","housing_type":"apartment"},
  "destination":{"city":"Nice","postal_code":"06000","floor":0,"elevator":"none","housing_type":"house"}}');
select lives_ok($$ select public.update_public_request((select access_token from d2), '{"customer":{"type":"individual","first_name":"Léa","last_name":"Martin-Durand","email":"lea@example.com","phone":"0699999999","privacy_accepted":true}}') $$,
  'Deuxième demande, même personne, autres coordonnées');

select isnt((select request_id from d1), (select request_id from d2), 'Nouvel identifiant de demande');
select isnt((select access_token from d1), (select access_token from d2), 'Nouveau jeton secret');
select isnt((pg_temp.req((select access_token from d1))).customer_id, (pg_temp.req((select access_token from d2))).customer_id, 'Fiche client propre à chaque demande');
select is((public.get_public_request((select access_token from d1)) #>> '{customer,full_name}'), 'Léa Martin', 'Coordonnées de la première demande intactes');
select is((public.get_public_request((select access_token from d1)) ->> 'moving_date'), '2027-03-15', 'Trajet de la première demande intact');
select is((pg_temp.req((select access_token from d1))).is_test, false, '« is_test » ignoré dans les données envoyées par le navigateur');
select throws_ok($$ update public.quote_requests set is_test = true $$, '42501', null, 'Visiteur anonyme : aucun accès direct à la table');
select is((select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.prokind = 'f' and pg_get_functiondef(p.oid) ilike '%is_test%'), 0, 'Aucune fonction publique ne modifie le marquage « simulation »');

select * from finish();
rollback;
