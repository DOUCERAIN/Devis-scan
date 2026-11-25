# Rapport de qualité — catalogue Devis Scan v3 (préparatoire)

Généré automatiquement par `scripts/catalogue_v3/rapports.py`. Données collectées le 25/11/2026.

## Observations par source

| Source | Observations | Utilisables | Licence | Niveau de droits |
| --- | ---: | ---: | --- | --- |
| Amazon Berkeley Objects (ABO) | 10 931 | 6 937 | CC BY 4.0 | 1 — réutilisable commercialement (attribution) |
| Smithsonian Open Access (dont Cooper Hewitt) | 4 964 | 2 941 | CC0 (enregistrements CC0 seulement) | 1 — réutilisable commercialement |
| Metropolitan Museum of Art — Open Access | 4 851 | 2 074 | CC0 | 1 — réutilisable commercialement |
| Wikidata | 1 167 | 727 | CC0 | 1 — réutilisable commercialement |
| Museum of Modern Art — Collection | 748 | 538 | CC0 | 1 — réutilisable commercialement |
| Cleveland Museum of Art — Open Access | 317 | 144 | CC0 (lignes CC0 seulement) | 1 — réutilisable commercialement |
| ItemFits Open Catalog | 131 | 0 | conditions contradictoires | 2 — documentaire uniquement |

## Complétude

| Dimensions | Observations |
| --- | ---: |
| 3 | 17 432 |
| 2 | 2 423 |
| 1 | 1 649 |

Les observations à une ou deux dimensions sont conservées telles quelles (jamais complétées) ; elles n'entrent pas dans les statistiques de volume.

## Fiabilité des observations

| Fiabilité | Observations |
| --- | ---: |
| moyenne | 10 358 |
| non vérifiée | 5 677 |
| faible | 4 071 |
| élevée | 3 003 |

## Observations exclues des statistiques (conservées)

| Motif | Observations |
| --- | ---: |
| — (utilisable) | 13 361 |
| dimensions hors des bornes plausibles de la sous-catégorie | 2 870 |
| dimensions incomplètes (profondeur manquante(s)) | 2 172 |
| dimensions incomplètes (hauteur, largeur, profondeur manquante(s)) | 1 605 |
| dimensions incomplètes (hauteur, profondeur manquante(s)) | 1 593 |
| lot ou ensemble | 797 |
| dimensions discordantes avec le nom du produit | 275 |
| dimensions incomplètes (hauteur manquante(s)) | 249 |
| source documentaire (réutilisation commerciale incertaine) | 131 |
| dimensions incomplètes (largeur, profondeur manquante(s)) | 56 |

- 1 092 observations avec une **erreur d'unité probable** : valeur d'origine conservée, jamais corrigée, exclue des statistiques.
- 7 944 observations de musée dont les dimensions sont écrites sans lettres (ex. « 89,5 × 59,7 × 50,8 cm ») : ordre hauteur × largeur × profondeur **supposé** (convention muséale), signalé dans `commentaires`. Le volume n'en dépend pas.

## Objets de musée écartés à la lecture (non enregistrés comme observations)

Les collections muséales contiennent des centaines de milliers d'objets ; seuls ceux qui correspondent à une sous-catégorie du catalogue sont retenus.

| Motif | Objets |
| --- | ---: |
| exclusions (maquettes, miniatures, jouets, fragments, éléments de meuble, gravures, photos, composants, enregistrements…) | 83 889 |
| aucune sous-catégorie correspondante | 61 699 |
| nettement plus petits que la sous-catégorie (moins de 60 % de sa borne basse : miroir à main, lampe à huile…) | 1 956 |
| aucune dimension lisible | 291 |

## Regroupement en produits physiques

| Statut | Observations |
| --- | ---: |
| produit unique | 15 816 |
| même produit (plusieurs fiches) | 6 194 |
| doublon potentiel (dimensions identiques, noms différents) | 1 099 |

Règles v2 inchangées (même identifiant, même marque + référence, même marque + mêmes dimensions). Ajout v3 : un même modèle de designer conservé par plusieurs musées (même auteur, même titre, dimensions à 5 cm près) forme un seul modèle.

## Indépendance des modèles

- produit du commerce : une **marque** = une source indépendante ;
- objet de musée ou Wikidata : un **auteur connu** (ébéniste, designer, fabricant) = une source indépendante ; un objet d'auteur inconnu compte pour lui-même.

## Fiabilité des sous-catégories

Critères inchangés : **élevée** ≥ 15 modèles, ≥ 3 sources indépendantes, dispersion ≤ 0,8 ; **moyenne** ≥ 5 modèles et 2 sources ; **faible** 1 à 4 modèles ; **non vérifiée** aucun modèle.

| Fiabilité | Sous-catégories |
| --- | ---: |
| moyenne | 112 |
| non vérifiée | 84 |
| faible | 74 |
| élevée | 41 |

## Sous-catégories les plus dispersées

| Sous-catégorie | Modèles | Médiane (m³) | Q1–Q3 (m³) | Dispersion |
| --- | ---: | ---: | --- | ---: |
| BRI-SCIE — Machine-outil d'atelier (scie, tour, perceuse à colonne) | 6 | 0,099 | 0,032 – 0,710 | 6,85 |
| ART-VASE-GRAND — Grand vase ou jarre | 12 | 0,053 | 0,031 – 0,302 | 5,11 |
| TEL-CRT — Téléviseur cathodique ou meuble téléviseur ancien | 50 | 0,078 | 0,030 – 0,357 | 4,2 |
| DEC-PARAVENT — Paravent ou séparateur | 8 | 0,383 | 0,098 – 1,483 | 3,61 |
| CHF-RADIATEUR — Radiateur ou chauffage d'appoint | 42 | 0,015 | 0,006 – 0,055 | 3,28 |
| COU-CHEVALET — Chevalet de peintre | 10 | 0,092 | 0,002 – 0,299 | 3,24 |
| DEC-HORLOGE — Horloge murale ou de cheminée | 592 | 0,013 | 0,003 – 0,043 | 3,07 |
| INF-ORDI — Ordinateur fixe, écran ou poste de travail | 6 | 0,052 | 0,030 – 0,188 | 3,05 |
| JAR-PARASOL — Parasol | 11 | 5,597 | 0,849 – 17,866 | 3,04 |
| MUS-HARPE — Harpe | 41 | 0,149 | 0,040 – 0,478 | 2,95 |
| MAC-ORDI-ANCIEN — Ordinateur ou terminal ancien | 99 | 0,022 | 0,003 – 0,064 | 2,82 |
| COU-METIER — Métier à tisser | 23 | 1,131 | 0,015 – 2,887 | 2,54 |
| MUS-PETIT — Instrument portatif (violon, vent, accordéon…) | 111 | 0,017 | 0,007 – 0,045 | 2,31 |
| BRI-COMPRESSEUR — Compresseur, groupe électrogène ou gros outillage | 7 | 0,079 | 0,062 – 0,241 | 2,25 |
| MUS-CLAVECIN — Clavecin, épinette ou clavicorde | 21 | 0,269 | 0,157 – 0,760 | 2,24 |

## Contrôle manuel du classement des objets de musée et Wikidata

Deux tirages au sort de 60 observations utilisées dans les statistiques, vérifiés une à une le 25/11/2026 :

| Tirage | Correctes | Erreurs relevées |
| --- | ---: | --- |
| 1 (graine 2026) | 53 / 60 | porte de climatiseur, lanterne de locomotive, mouvement d'horloge, cadrans d'horloge, cloche à vide, plateau de table seul, talkie-walkie |
| 2 (graine 77, après correction du tirage 1) | 55 / 60 | « Arm chair » classé chaise au lieu de fauteuil, candélabre classé guéridon, jeu vidéo classé ordinateur, miroir concave scientifique, caisse de machine à écrire classée bac |

Précision estimée : **108 / 120, soit environ 90 %** (intervalle de confiance à 95 % : environ 83 à 94 %), inférieure à celle des fiches commerciales v2 (94 %). Les erreurs relevées ont été corrigées dans les règles avant la construction finale. Les objets mal classés restants sont souvent petits et tombent hors des bornes de plausibilité ; ils sont alors exclus des statistiques.

Classement des objets anciens (datés d'avant 1950 ou non datés) : un meuble est rangé en mobilier ancien (`ANC-*`) ; un instrument, une machine ou un appareil garde sa sous-catégorie d'usage (piano, machine à coudre, radio…). Conséquence : un fauteuil de designer de 1929 (ex. « Brno ») est classé fauteuil ancien.

## Limites connues

- **Volume géométrique ≠ volume de déménagement** (inchangé, voir `architecture_catalogue.md`).
- **Biais des collections muséales** : objets anciens, de prestige ou de designer ; beaucoup de chaises, tables, horloges, radios, machines à écrire. Le champ `part_objets_de_collection_pct` de chaque référence indique la part de modèles issus de collections.
- **Dimensions de musée** : hors tout quand le musée l'écrit (« overall »), sinon dimension principale ; ordre parfois supposé.
- **Fiches commerciales** : toujours dominées par les marques propres d'Amazon (ABO) ; aucune marque française collectée (voir `rapport_sources.md`).
