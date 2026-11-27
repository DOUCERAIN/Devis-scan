-- =============================================================================
-- Demandes successives depuis le même appareil : simulations de test repérées
-- =============================================================================
-- Une demande créée avec « Nouvelle simulation » (réservée aux entreprises de démonstration et aux
-- environnements de test, contrôle côté serveur) est marquée is_test : elle reste une demande complète
-- et conservée, affichée « Simulation » dans l'espace pro et exclue des compteurs du tableau de bord.
-- Le drapeau n'est posé que par le serveur (clé secrète) : aucune fonction publique ne permet de le
-- modifier. Aucune donnée existante n'est modifiée.
alter table public.quote_requests add column if not exists is_test boolean not null default false;
comment on column public.quote_requests.is_test is
  'Demande créée par « Nouvelle simulation » (démonstration ou test) : conservée, signalée dans l''espace pro, exclue des compteurs.';
