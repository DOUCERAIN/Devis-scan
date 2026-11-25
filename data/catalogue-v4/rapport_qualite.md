# Rapport de qualité — catalogue Devis Scan v4 (préparatoire)

Généré par `scripts/catalogue_v4/rapports.py`. L'audit des dimensions et des volumes est dans `rapport_audit_dimensions.md` ; le classement des objets reste contrôlé comme en v3 (≈ 94 % pour les fiches du commerce, ≈ 90 % pour les objets de musée).

## Observations par source

| Source | Observations | Utilisables | Licence | Niveau de droits |
| --- | ---: | ---: | --- | --- |
| Amazon Berkeley Objects (ABO) | 11 032 | 6 971 | CC BY 4.0 | 1 |
| ENERGY STAR (EPA, États-Unis) | 6 999 | 872 | domaine public | 1 |
| Smithsonian Open Access | 4 971 | 2 650 | CC0 | 1 |
| Metropolitan Museum of Art | 4 851 | 2 009 | CC0 | 1 |
| Wikidata | 1 166 | 706 | CC0 | 1 |
| Museum of Modern Art | 748 | 504 | CC0 | 1 |
| Cleveland Museum of Art | 317 | 139 | CC0 | 1 |
| ItemFits | 131 | 0 | conditions contradictoires | 2 |

## Complétude

| Dimensions | Observations |
| --- | ---: |
| 3 | 18 488 |
| 2 | 8 130 |
| 1 | 1 960 |

Nouveau en v4 : les fiches à 1 ou 2 dimensions plausibles d'une source autorisée alimentent des **médianes partielles** (champ `dimensions_partielles` de chaque référence), sans jamais être combinées en volume.

## Fiabilité des observations

| Fiabilité | Observations |
| --- | ---: |
| non vérifiée | 11 727 |
| moyenne | 10 847 |
| faible | 4 637 |
| élevée | 3 004 |

## Motifs d'exclusion des statistiques (observations conservées)

| Motif | Observations |
| --- | ---: |
| — (utilisable) | 13 851 |
| dimensions incomplètes (profondeur manquante(s)) | 7 117 |
| dimensions hors des bornes plausibles de la sous-catégorie | 2 964 |
| dimensions incomplètes (hauteur, profondeur manquante(s)) | 1 904 |
| dimensions incomplètes (hauteur, largeur, profondeur manquante(s)) | 1 637 |
| dimensions incomplètes (hauteur manquante(s)) | 1 011 |
| lot ou ensemble | 797 |
| objet ancien : non représentatif de la sous-catégorie actuelle (conservé à titre documentaire) | 447 |
| dimensions discordantes avec le nom du produit | 300 |
| source documentaire (réutilisation commerciale incertaine) | 131 |
| dimensions incomplètes (largeur, profondeur manquante(s)) | 56 |

## Contrôles de classement propres à la v4

- **ENERGY STAR** : classement déterministe par le type publié (« Bottom Freezer » → réfrigérateur combiné, « Side-by-Side » → réfrigérateur américain, « Compact Refrigerator » → table top, « Cooler » → cave à vin, « Range » → cuisinière). Les lavantes-séchantes, publiées aussi dans les listes de lave-linge et de sèche-linge, sont regroupées en un seul modèle classé « lave-linge séchant ».
- **Matelas ABO** : de vrais matelas publiés sous d'autres types de produit sont désormais pris en compte. Contrôle manuel de toutes les fiches retenues : des draps-housses « 180 × 200 », des taies « King », des sommiers et un surmatelas avaient été pris par erreur lors d'un premier essai, puis exclus (le mot « matelas » est désormais exigé).
- **Téléviseurs ABO** : 4 fiches où l'épaisseur était publiée comme hauteur ; axes réordonnés, valeurs d'origine conservées.
- **Canapé en U** (Stone & Beam Andover) : les fiches sont reconnues, mais leurs dimensions (224 × 104 cm) ne correspondent pas au canapé annoncé (134 pouces, 340 cm) : exclues (hors bornes).
