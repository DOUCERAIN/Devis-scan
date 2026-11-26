-- =============================================================================
-- Validation de l'inventaire par le client, décisions séparées client / déménageur,
-- avenants à un devis accepté, vérifications et e-mails (traçabilité, isolation).
-- =============================================================================
begin;
create extension if not exists pgtap with schema extensions;
select plan(34);

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at)
values
  ('a5a5a5a5-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'anna5@test.local', '{}', now(), now()),
  ('b5b5b5b5-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'bruno5@test.local', '{}', now(), now());

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

select pg_temp.login('a5a5a5a5-0000-4000-8000-000000000001');
select public.create_company('Anna Déménagement Cinq');
select pg_temp.login('b5b5b5b5-0000-4000-8000-000000000002');
select public.create_company('Bruno Transport Cinq');
select pg_temp.reset();

create temp table ctx as
  select (select c.slug from public.companies c join public.company_members m on m.company_id = c.id where m.user_id = 'a5a5a5a5-0000-4000-8000-000000000001') as slug_a,
         (select company_id from public.company_members where user_id = 'a5a5a5a5-0000-4000-8000-000000000001') as company_a;
grant select on ctx to anon, authenticated;

-- Demande envoyée, analysée : inventaire en attente de validation du client
select pg_temp.anon();
create temp table t as select * from public.create_public_request((select slug_a from ctx), '{
  "customer":{"full_name":"Léa Client","email":"lea@example.com"},
  "origin":{"city":"Lyon","postal_code":"69001"},"destination":{"city":"Paris","postal_code":"75001"}}');
select pg_temp.reset();
grant select on t to anon, authenticated;
insert into public.rooms (request_id, company_id, name) select request_id, (select company_a from ctx), 'Chambre' from t;
insert into public.room_videos (request_id, company_id, room_id, storage_path, status)
  select t.request_id, (select company_a from ctx), r.id, 'test/' || t.request_id || '/chambre.mp4', 'uploaded' from t join public.rooms r on r.request_id = t.request_id;
select pg_temp.anon();
create temp table v as select public.submit_public_request((select access_token from t)) as view_token;
select pg_temp.reset();
grant select on v to anon, authenticated;
update public.quote_requests set status = 'awaiting_customer' where id = (select request_id from t);
insert into public.inventory_items (request_id, company_id, room_id, name, catalog_key, quantity, unit_volume_m3, source, confidence, possible_duplicate, duplicate_reason)
select t.request_id, (select company_a from ctx), r.id, x.name, x.key, 1, x.vol, 'ai', 0.9, x.dup, x.reason
  from t join public.rooms r on r.request_id = t.request_id,
  (values ('Lit simple', 'lit-simple', 0.8, false, null),
          ('Lit simple ', 'lit-simple', 0.8, true, 'Même type de meuble…'),
          ('Armoire 2 portes', 'armoire-2-portes', 0.8, true, 'Doute signalé par l''IA : même poignée')) as x(name, key, vol, dup, reason);
create temp table items as select
  (select id from public.inventory_items where request_id = (select request_id from t) and name = 'Lit simple ') as bed2,
  (select id from public.inventory_items where request_id = (select request_id from t) and name = 'Armoire 2 portes') as wardrobe,
  (select id from public.inventory_items where request_id = (select request_id from t) and name = 'Lit simple') as bed1;
grant select on items to anon, authenticated;

-- Lecture de l'inventaire par le client ----------------------------------------------
select pg_temp.anon();
select is(jsonb_array_length(public.get_public_inventory((select view_token from v)) -> 'items'), 3, 'Le client voit tout son inventaire');
select is((select count(*)::int from jsonb_array_elements(public.get_public_inventory((select view_token from v)) -> 'items') e where (e ->> 'possible_duplicate')::boolean), 2,
  'Deux éléments à vérifier');
select throws_ok($$ select public.get_public_inventory(repeat('0', 64)) $$, '42501', null, 'Faux lien refusé');

-- Validation : avertissement et toutes les réponses obligatoires --------------------------
do $$ begin perform public.public_set_extra_boxes((select view_token from v), 0); end $$;
select throws_ok(format($$ select public.validate_public_inventory((select view_token from v), '{"%s":"same","%s":"distinct"}', '') $$, (select bed2 from items), (select wardrobe from items)),
  '22023', null, 'Avertissement non accepté : validation refusée');
select throws_ok(format($$ select public.validate_public_inventory((select view_token from v), '{"%s":"same"}', 'Merci de vérifier attentivement votre inventaire…') $$, (select bed2 from items)),
  '22023', null, 'Un élément sans réponse : validation refusée');
select throws_ok(format($$ select public.validate_public_inventory((select view_token from v), '{"%s":"same","%s":"distinct","%s":"same"}', 'Merci de vérifier attentivement votre inventaire…') $$,
  (select bed2 from items), (select wardrobe from items), (select bed1 from items)),
  '22023', null, 'Réponse pour un élément qui n''est pas à vérifier : refusée');
select throws_ok(format($$ select public.validate_public_inventory((select view_token from v), '{"%s":"peut-etre","%s":"distinct"}', 'Merci de vérifier attentivement votre inventaire…') $$, (select bed2 from items), (select wardrobe from items)),
  '22023', null, 'Réponse invalide refusée');
select is(public.validate_public_inventory((select view_token from v), format('{"%s":"same","%s":"distinct"}', (select bed2 from items), (select wardrobe from items))::jsonb,
  'Merci de vérifier attentivement votre inventaire et de répondre avec honnêteté.'), 'validated', 'Inventaire validé avec toutes les réponses');
select throws_ok(format($$ select public.validate_public_inventory((select view_token from v), '{"%s":"distinct","%s":"distinct"}', 'Merci de vérifier attentivement votre inventaire…') $$, (select bed2 from items), (select wardrobe from items)),
  '55000', null, 'Une seconde validation est refusée (réponses figées)');

select pg_temp.reset();
select is((select status::text from public.quote_requests where id = (select request_id from t)), 'customer_validated', 'Statut : inventaire validé par le client');
select is((select verification_status from public.quote_requests where id = (select request_id from t)), 'pending', 'Vérification humaine en attente');
select isnt((select customer_acknowledged_at from public.quote_requests where id = (select request_id from t)), null, 'Date d''acceptation de l''avertissement enregistrée');
select is((select customer_duplicate_decision from public.inventory_items where id = (select bed2 from items)), 'same', 'Réponse « même meuble » enregistrée');
select is((select count(*)::int from public.inventory_item_changes where request_id = (select request_id from t) and actor = 'customer' and action = 'customer_decision'), 2,
  'Chaque réponse du client est inscrite dans l''historique');
select is((select volume_after_m3 from public.inventory_item_changes where item_id = (select bed2 from items) and actor = 'customer'), 0.000::numeric, 'Impact sur le volume enregistré (même meuble : compté une fois)');

-- Décisions séparées : le déménageur n'écrase jamais la réponse du client ---------------------
select pg_temp.login('a5a5a5a5-0000-4000-8000-000000000001');
select throws_ok(format($$ update public.inventory_items set customer_duplicate_decision = 'distinct' where id = '%s' $$, (select bed2 from items)),
  '42501', null, 'Un membre ne peut pas modifier la réponse du client');
select lives_ok(format($$ update public.inventory_items set mover_duplicate_decision = 'distinct', mover_decided_at = now() where id = '%s' $$, (select bed2 from items)),
  'Le déménageur enregistre sa propre décision');
select is((select customer_duplicate_decision from public.inventory_items where id = (select bed2 from items)), 'same', 'La réponse du client reste intacte');
select throws_ok(format($$ insert into public.inventory_item_changes (request_id, company_id, action, actor, changed_by) values ('%s', '%s', 'customer_decision', 'customer', auth.uid()) $$,
  (select request_id from t), (select company_a from ctx)), '42501', null, 'Un membre ne peut pas écrire au nom du client dans l''historique');

-- Devis : acceptation, avenant, refus de l'avenant -----------------------------------------
select pg_temp.reset();
insert into public.quotes (request_id, company_id, status, version, kind, origin, total_ttc_cents, lines, sent_at)
  select request_id, (select company_a from ctx), 'sent', 1, 'formal', 'customer_validation', 98000, '[]', now() from t;
create temp table q as select (select id from public.quotes where request_id = (select request_id from t) and version = 1) as v1;
grant select on q to anon, authenticated;
select pg_temp.anon();
select is(public.respond_public_quote((select view_token from v), (select v1 from q), 'accepted'), 'accepted', 'Le client accepte son devis final sans attendre la vérification');
select pg_temp.reset();
select throws_ok($$ insert into public.quotes (request_id, company_id, status, version, kind, origin, total_ttc_cents, lines)
                    select request_id, (select company_a from ctx), 'sent', 2, 'formal', 'verification', 104000, '[]' from t $$, '55000', null,
  'Après acceptation : pas de nouvelle version qui remplacerait le devis accepté');
select throws_ok($$ insert into public.quotes (request_id, company_id, status, version, kind, origin, total_ttc_cents, lines, amends_quote_id)
                    select request_id, (select company_a from ctx), 'accepted', 2, 'formal', 'verification', 104000, '[]', (select v1 from q) from t $$, '55000', null,
  'Un avenant n''est jamais accepté d''office');
select lives_ok($$ insert into public.quotes (request_id, company_id, status, version, kind, origin, total_ttc_cents, lines, amends_quote_id, sent_at)
                   select request_id, (select company_a from ctx), 'sent', 2, 'formal', 'verification', 104000, '[]', (select v1 from q), now() from t $$,
  'Avenant au devis accepté, soumis au client');
select throws_ok($$ update public.quotes set amends_quote_id = null where request_id = (select request_id from t) and version = 2 $$, '55000', null, 'Version figée (lien d''avenant compris)');
create temp table q2 as select id from public.quotes where request_id = (select request_id from t) and version = 2;
grant select on q2 to anon;
select pg_temp.anon();
select is(public.respond_public_quote((select view_token from v), (select id from q2), 'refused'), 'refused', 'Le client refuse l''avenant');
select pg_temp.reset();
select is((select status::text from public.quotes where id = (select v1 from q)), 'accepted', 'Avenant refusé : le devis accepté reste en vigueur');
select is((select status::text from public.quote_requests where id = (select request_id from t)), 'accepted', 'Avenant refusé : la demande reste acceptée');
select throws_ok(format($$ update public.quotes set status = 'superseded' where id = '%s' $$, (select v1 from q)), '55000', null, 'Un devis accepté reste immuable');

-- Vérifications et e-mails : traçabilité et isolation ------------------------------------
select pg_temp.login('a5a5a5a5-0000-4000-8000-000000000001');
select lives_ok(format($$ insert into public.inventory_verifications (request_id, company_id, outcome, reason, quote_before_id, verified_by)
                          values ('%s', '%s', 'corrected_same_terms', 'Lit en double', '%s', auth.uid()) $$, (select request_id from t), (select company_a from ctx), (select v1 from q)),
  'Le déménageur enregistre sa vérification');
select throws_ok(format($$ insert into public.inventory_verifications (request_id, company_id, outcome, verified_by) values ('%s', '%s', 'corrected_new_version', auth.uid()) $$,
  (select request_id from t), (select company_a from ctx)), '23514', null, 'Une correction sans raison est refusée');
select throws_ok($$ update public.inventory_verifications set reason = 'autre' $$, '42501', null, 'Une vérification n''est jamais modifiée');
select throws_ok(format($$ insert into public.customer_notifications (request_id, company_id, kind, subject, body_text, status) values ('%s', '%s', 'inventory_corrected', 'x', 'x', 'sent') $$,
  (select request_id from t), (select company_a from ctx)), '42501', null, 'Un e-mail ne peut pas être déclaré envoyé sans service d''e-mail');
select pg_temp.login('b5b5b5b5-0000-4000-8000-000000000002');
select is((select count(*)::int from public.inventory_verifications where request_id = (select request_id from t)), 0, 'Autre entreprise : aucune vérification visible');

select pg_temp.anon();
select is(jsonb_array_length(public.get_public_quote_view((select view_token from v)) -> 'corrections'), 1, 'Le client voit la correction (jamais une simple confirmation)');

select * from finish();
rollback;
