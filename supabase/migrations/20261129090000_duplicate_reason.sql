-- Dédoublonnage revu (26/11/2026) : un doublon possible n'est plus jamais écarté du volume.
-- Il reste compté « à vérifier » jusqu'à la décision du déménageur (« Retirer » ou « Pas un doublon »).
-- Nouvelle colonne : les indices qui ont conduit au signalement, affichés au déménageur.
-- Aucune donnée existante n'est modifiée ; les signalements existants restent, sans explication.
alter table public.inventory_items
  add column duplicate_reason text check (char_length(duplicate_reason) <= 500);

comment on column public.inventory_items.possible_duplicate is
  'Peut-être le même objet physique qu''un autre élément (duplicate_of_item_id). Compté dans le volume « à vérifier » tant qu''une personne n''a pas tranché ; jamais retiré automatiquement.';
comment on column public.inventory_items.duplicate_reason is
  'Indices du signalement de doublon possible (doute de l''IA, images, position), en français.';
