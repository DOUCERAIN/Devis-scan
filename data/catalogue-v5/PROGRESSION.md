# Progression — catalogue Devis Scan v5

Dernière mise à jour : 27/11/2026. Chiffres : `tableau_bord.md`, `rapport_audit_dimensions.md`, `rapport_pertinence.md`.

## Fait

1. **Audit des données v4** sans nouvelle collecte : listes exhaustives des orientations ambiguës, erreurs d'unité, discordances avec le nom, profils de colis, produits modulaires, modèles aberrants (`audit/`).
2. **151 corrections de dimensions justifiées**, toutes traçables : 70 orientations (hauteur ou ordre écrits dans le nom, diagonale des téléviseurs), 2 unités, 79 fiches remplacées par les trois dimensions annoncées dans le nom. Aucune permutation sans preuve.
3. **Orientation** : nouveau critère (rang de la hauteur), 1 121 observations ambiguës exclues des dimensions médianes, contre 1 652 suspectes avec le critère v4. Les dimensions médianes ne portent plus que sur les modèles d'orientation fiable.
4. **Exclusions nouvelles** : 125 profils de colis à plat, 29 éléments de produits modulaires.
5. **Contrôle manuel de 100 observations** orienté vers les cas difficiles. Après garde-fous : classement 96 / 100, dimensions plausibles 96 / 100, volume fiable 98 / 100, corrections justes 30 / 30.
6. **Mesurabilité et transport** : 3 sous-catégories non directement mesurables (justifiées), 21 à méthode spécifique, champs démontable, pliable et empilable, et facteur de conversion laissé vide.
7. **EPREL** : conditions officielles étudiées, démarche préparée, scripts prêts et inactifs. Constat : EPREL ne publie pas les dimensions extérieures des téléviseurs.
8. **Indicateurs** : deux dénominateurs, couverture par niveau de pertinence, références exploitables, correspondance des 134 références.

## Objectif des 80 % : toujours non atteint

| | v4 | v5 |
| --- | ---: | ---: |
| Prioritaires à 3 dimensions, dénominateur historique | 132 / 171 (77,2 %) | **132 / 171 (77,2 %)** |
| Prioritaires mesurables à 3 dimensions | — | **132 / 169 (78,1 %)** |
| Catégories courantes à 3 dimensions | 77 / 87 | 77 / 87 (88,5 %) |

Pourquoi : la v5 n'a trouvé **aucune donnée réelle nouvelle** à trois dimensions pour les 39 sous-catégories manquantes dans les sources accessibles (`rapport_sous_categories_manquantes.md`). La consolidation a amélioré la **fiabilité** des valeurs, pas le nombre de catégories documentées.

## Ce qui débloquerait l'objectif

1. **EPREL** (votre démarche, `rapport_eprel.md` § 5) : 6 sous-catégories prioritaires d'électroménager, soit environ 138 / 171 (80,7 %).
2. **Relevés des déménageurs pilotes** : téléviseurs 55 et 75 pouces, meubles d'entrée, dressings, colonnes de salle de bain, poussettes, matériel de sport, et surtout le volume réellement chargé.

## Limites réelles

- Électroménager à trois dimensions = modèles nord-américains (ENERGY STAR).
- Le contrôle manuel v5 porte sur un échantillon orienté vers les cas difficiles : ses taux ne s'extrapolent pas à tout le catalogue.
- Pertinence et pondération : appréciations qualitatives, pas des fréquences mesurées.
- Volume géométrique ≠ volume de déménagement : aucune convention validée à ce jour.

## Non fait (volontairement)

Aucune clé demandée, aucun compte, aucune signature, aucune entreprise contactée, aucune donnée payante, aucun appel Anthropic, aucune écriture Supabase, aucune migration, aucune modification du moteur IA ni du parcours client, aucune modification de `main` ou de la production, aucune référence supprimée. Versions 2, 3 et 4 intactes.
