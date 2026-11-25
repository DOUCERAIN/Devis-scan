-- Coût des analyses IA : 10 décimales au lieu de 5.
-- Avec 5 décimales, un très petit coût réel (ex. 0,0000047 $) était enregistré 0 $.
-- Élargissement sans perte : les valeurs existantes sont conservées telles quelles.
alter table public.analysis_runs
  alter column cost_usd type numeric(16, 10);

comment on column public.analysis_runs.cost_usd is
  'Coût estimé de l''analyse en dollars (tarifs publics), 10 décimales : un coût positif n''est jamais arrondi à 0. Voir src/lib/ai/cost.ts.';
