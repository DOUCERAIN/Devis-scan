-- Droits explicites du rôle serveur (service_role, clé secrète, jamais exposée au navigateur).
--
-- En local, Supabase accorde ces droits automatiquement ; les projets Supabase récents en ligne ne le font
-- plus pour les tables créées par les migrations. Sans eux, les tâches serveur (envoi des vidéos, images,
-- analyse, purge RGPD, devis après validation du client) échouent avec « permission denied ».
-- Aucun droit n'est ajouté aux visiteurs (anon) ni aux utilisateurs connectés (authenticated) ; les règles
-- RLS sont inchangées (service_role les contourne par conception, comme partout dans Supabase).
grant usage on schema public to service_role;
grant select, insert, update, delete on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;

-- Tables, séquences et fonctions créées plus tard par les migrations.
alter default privileges in schema public grant select, insert, update, delete on tables to service_role;
alter default privileges in schema public grant usage, select on sequences to service_role;
alter default privileges in schema public grant execute on functions to service_role;
