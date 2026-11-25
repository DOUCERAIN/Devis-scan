# Progression — catalogue Devis Scan v4

Dernière mise à jour : 26/11/2026. Chiffres détaillés : `tableau_bord.md`, `rapport_pertinence.md`, `rapport_audit_dimensions.md`.

## Fait

1. **Pertinence pour le déménagement** : 311 sous-catégories classées une à une (87 courantes, 139 complémentaires, 66 spécifiques, 19 peu pertinentes), 46 familles avec un niveau par défaut. Aucune référence supprimée. Appréciation qualitative, à recalibrer avec des inventaires réels.
2. **Électroménager** : nouvelle source ENERGY STAR (EPA, domaine public, licence lue) : 6 999 observations. Sèche-linge (491 modèles), lave-linge (108), lavantes-séchantes (8), cuisinières (95) à 3 dimensions ; réfrigérateurs, caves à vin et lave-vaisselle à 2 dimensions (partielles).
3. **Réexamen d'ABO** : matelas réels récupérés (5 sous-catégories, 39 modèles), téléviseurs à axes inversés corrigés, canapés « slipcover » reconnus comme canapés.
4. **Règle des objets anciens** : les objets de musée d'avant 1950 ne documentent plus les sous-catégories actuelles (447 observations retirées des statistiques, conservées).
5. **Dimensions partielles** : médianes séparées de hauteur, largeur et profondeur quand une source n'en publie que deux (jamais de volume calculé).
6. **Audit des dimensions et des volumes**, distinct du classement : orientation, unités, colis, aberrants, recalcul des volumes, variantes, et contrôle manuel de 90 observations (87 plausibles).
7. **Couverture métier** : couverture par niveau, couverture pondérée (qualitative), références exploitables par le moteur IA.

## Objectif des 80 % : non atteint

| | v3 | v4 |
| --- | ---: | ---: |
| Sous-catégories prioritaires à dimensions complètes | 130 / 171 (76 %) | **132 / 171 (77,2 %)** |
| dont partielles seulement (2 dimensions) | — | 6 |
| Sans `DIV-AUTRE` et `CAR-SAC` (non mesurables par nature) | — | 132 / 169 (78,1 %) |

Il manque 5 sous-catégories. Les gains (sèche-linge, cuisinière, téléviseurs 32 et 43 pouces) ont été en partie compensés par la règle des objets anciens : lit bébé, lave-vaisselle et établi n'étaient documentés que par des objets de musée. **Aucune donnée n'a été fabriquée** : une dimension manquante n'est jamais déduite (par exemple la profondeur d'un réfrigérateur à partir de sa capacité, ou les dimensions d'un téléviseur à partir de sa diagonale).

## Ce qui permettrait d'atteindre 80 %

1. **EPREL** (Union européenne) : dimensions complètes des réfrigérateurs, congélateurs, caves à vin, lave-vaisselle et téléviseurs vendus en Europe. À elle seule, cette source documenterait probablement 8 sous-catégories prioritaires : `ELM-REF-US`, `ELM-REF-COMBI`, `ELM-REF-TOP`, `ELM-CONG`, `ELM-CAVE`, `ELM-LV`, `INF-TV-55`, `INF-TV-75`. On atteindrait alors environ 140 / 171, soit 82 %. **Nécessite votre accord** pour demander une clé gratuite au nom de Devis Scan (organisation, représentant légal, description de l'usage, acceptation de conditions à lire).
2. **Relevés des déménageurs pilotes** : seule source réaliste pour les meubles d'entrée, dressings, colonnes de salle de bain, coffres à jouets, poussettes, matériel de sport, et pour le volume réellement chargé.
3. Hôtes de données ouvertes encore bloqués (data.gouv.fr, data.europa.eu, open.canada.ca) : aucun jeu de dimensions de mobilier identifié à ce jour, à réexaminer si besoin.

## Limites réelles

- Électroménager ENERGY STAR = modèles nord-américains (plus grands que les modèles européens) : à signaler au moteur et à remplacer ou compléter par EPREL.
- Le mobilier courant reste dominé par les marques propres d'Amazon (ABO) ; aucune enseigne française.
- Les niveaux de pertinence et les poids de la couverture métier sont des appréciations, pas des fréquences mesurées.
- Volume géométrique ≠ volume de déménagement (inchangé).

## Non fait (volontairement)

Aucune écriture en base, aucune migration, aucune modification du moteur IA ni du parcours client, aucun appel payant, aucun compte créé, aucune clé demandée, aucune entreprise contactée, aucune modification de `main` ni de la production, aucune suppression de référence. Les versions 2 et 3 sont intactes.
