# Rapport de qualité — catalogue Devis Scan v2 (préparatoire)

Généré automatiquement par `scripts/catalogue_v2/rapports.py`. Données collectées le 25/11/2026.

## Chiffres clés

| Indicateur | Valeur |
| --- | ---: |
| Observations (fiches produit collectées) | 11 536 |
| dont ABO (CC BY 4.0) | 10 311 |
| dont Wikidata (CC0) | 1 101 |
| dont ItemFits (documentaire, réutilisation incertaine) | 124 |
| Produits physiques indépendants (après regroupement) | 6 701 |
| Produits utilisables pour les statistiques | 3 741 |
| Observations avec 3 dimensions | 9 763 (85 %) |
| Observations utilisables pour une estimation de volume | 7 186 (62 %) |
| Familles | 30 |
| Sous-catégories physiques | 197 |
| Variantes de taille calculées | 111 |

## Complétude des observations

| Complétude | Observations |
| --- | ---: |
| complète (3 dimensions) | 9 763 |
| aucune dimension | 1 493 |
| partielle (2 dimensions) | 233 |
| partielle (1 dimension) | 47 |

## Fiabilité des observations

- **élevée** : 3 dimensions plausibles, concordantes avec les dimensions écrites dans le nom du produit ;
- **moyenne** : 3 dimensions plausibles, sans vérification possible par le nom ;
- **faible** : 3 dimensions mais hors bornes, lot, discordance avec le nom, ou source documentaire ;
- **non vérifiée** : dimensions incomplètes.

| Fiabilité | Observations |
| --- | ---: |
| moyenne | 4 327 |
| élevée | 2 859 |
| faible | 2 577 |
| non vérifiée | 1 773 |

## Observations exclues des statistiques (conservées dans la base)

| Motif | Observations |
| --- | ---: |
| — (utilisable) | 7 186 |
| dimensions hors des bornes plausibles de la sous-catégorie | 1 497 |
| dimensions incomplètes (hauteur, largeur, profondeur manquante(s)) | 1 493 |
| lot ou ensemble | 684 |
| dimensions discordantes avec le nom du produit | 274 |
| dimensions incomplètes (profondeur manquante(s)) | 203 |
| source documentaire (réutilisation commerciale incertaine) | 124 |
| dimensions incomplètes (hauteur manquante(s)) | 28 |
| dimensions incomplètes (hauteur, profondeur manquante(s)) | 27 |
| dimensions incomplètes (largeur, profondeur manquante(s)) | 20 |

Dont 393 observations avec une **erreur d'unité probable** (par exemple des millimètres déclarés comme centimètres) : la valeur d'origine est conservée telle quelle, jamais corrigée, et exclue des statistiques.

## Regroupement des fiches en produits physiques

| Statut | Observations |
| --- | ---: |
| même produit (plusieurs fiches) | 5 444 |
| produit unique | 5 005 |
| doublon potentiel (dimensions identiques, noms différents) | 1 087 |

Règles : une même fiche publiée dans plusieurs pays (même identifiant ASIN), une même marque et une même référence fabricant, ou une même marque avec une même sous-catégorie et des dimensions identiques au centimètre (variantes de couleur) forment un seul produit. Quand des fiches d'un même pays ainsi regroupées portent des noms différents, le statut « doublon potentiel » est affiché : le regroupement est conservé pour les statistiques (un seul modèle), toutes les fiches restent visibles.

## Fiabilité des sous-catégories du catalogue normalisé

- **élevée** : au moins 15 modèles indépendants, au moins 3 marques, dispersion (Q3 − Q1) / médiane ≤ 0,8 ;
- **moyenne** : au moins 5 modèles et 2 marques ;
- **faible** : 1 à 4 modèles (ou une seule marque) — volume provisoire, jamais une statistique représentative ;
- **non vérifiée** : aucun modèle complet et plausible.

| Fiabilité | Sous-catégories |
| --- | ---: |
| moyenne | 63 |
| non vérifiée | 63 |
| faible | 42 |
| élevée | 29 |

Méthode : valeurs aberrantes exclues (avec justification) par la règle de Tukey sur le logarithme du volume (écart interquartile × 2) dès 8 modèles ; médiane, Q1, Q3, minimum, maximum calculés sur les modèles indépendants (pas sur le nombre de fiches). Jamais de moyenne.

## Sous-catégories les plus dispersées (variantes à envisager)

| Sous-catégorie | Modèles | Médiane (m³) | Q1–Q3 (m³) | Dispersion |
| --- | ---: | ---: | --- | ---: |
| JAR-PARASOL — Parasol | 11 | 5,597 | 0,849 – 17,866 | 3,04 |
| ANC-COFFRE — Coffre ancien | 26 | 0,239 | 0,069 – 0,537 | 1,96 |
| SPO-TENTE — Tente et gros matériel de camping | 7 | 2,735 | 0,057 – 5,229 | 1,89 |
| DEC-TABLEAU — Tableau ou cadre | 202 | 0,007 | 0,003 – 0,014 | 1,56 |
| DEC-TAPIS-NC — Tapis (taille non précisée) | 62 | 0,036 | 0,020 – 0,076 | 1,55 |
| ETA-NC — Étagère sur pieds | 39 | 0,179 | 0,099 – 0,374 | 1,54 |
| CHA-BANC — Banc | 50 | 0,235 | 0,192 – 0,551 | 1,53 |
| ANC-AUTRE — Autre meuble ancien | 279 | 0,247 | 0,157 – 0,532 | 1,52 |
| ANC-TABLE — Table ancienne | 38 | 0,345 | 0,169 – 0,659 | 1,42 |
| ETA-METAL — Étagère métallique ou rayonnage | 17 | 0,469 | 0,431 – 1,075 | 1,37 |
| PEM-VENTIL — Ventilateur ou radiateur d'appoint | 38 | 0,039 | 0,008 – 0,060 | 1,36 |
| ETA-MURALE — Étagère murale | 12 | 0,032 | 0,015 – 0,057 | 1,3 |
| DEC-LAMPE — Lampe à poser | 69 | 0,033 | 0,018 – 0,061 | 1,3 |
| LIT-DOUBLE — Lit double (135 à 140 cm) | 18 | 1,023 | 0,898 – 2,217 | 1,29 |
| SPO-BANC-MUSCU — Banc de musculation ou station | 5 | 0,754 | 0,229 – 1,186 | 1,27 |

## Sous-catégories insuffisamment documentées (moins de 5 modèles) : 101 sur 197

| Sous-catégorie | Famille | Modèles | Fiabilité |
| --- | --- | ---: | --- |
| ARM-ANG — Armoire d'angle | Armoires et penderies | 2 | faible |
| ARM-5P+ — Armoire 5 portes et plus | Armoires et penderies | 3 | faible |
| ARM-4P — Armoire 4 portes | Armoires et penderies | 3 | faible |
| ARM-1P — Armoire 1 porte | Armoires et penderies | 3 | faible |
| ARM-TISSU — Armoire en tissu ou penderie démontable | Armoires et penderies | 0 | non vérifiée |
| ARM-BAS — Armoire basse | Armoires et penderies | 0 | non vérifiée |
| ARM-DRESS — Dressing (module ou ensemble) | Armoires et penderies | 0 | non vérifiée |
| CAN-PANO — Canapé panoramique | Canapés | 0 | non vérifiée |
| CAN-MOD — Canapé modulable | Canapés | 0 | non vérifiée |
| CAN-RELAX — Canapé relax | Canapés | 2 | faible |
| CAN-5P — Canapé 5 places et plus | Canapés | 0 | non vérifiée |
| CAN-4P — Canapé 4 places | Canapés | 0 | non vérifiée |
| FAU-POIRE — Pouf poire | Poufs et repose-pieds | 2 | faible |
| LIT-ESCAM — Lit escamotable | Lits et têtes de lit | 0 | non vérifiée |
| LIT-BEBE — Lit bébé | Mobilier et équipements pour enfants | 0 | non vérifiée |
| MAT-180 — Matelas 180 cm et plus | Matelas et sommiers | 0 | non vérifiée |
| MAT-160 — Matelas 150 à 160 cm | Matelas et sommiers | 2 | faible |
| MAT-140 — Matelas 135 à 140 cm | Matelas et sommiers | 2 | faible |
| MAT-90 — Matelas 80 à 100 cm | Matelas et sommiers | 3 | faible |
| COM-COIFF — Coiffeuse | Commodes et chiffonniers | 2 | faible |
| COM-SEMAINIER — Chiffonnier ou semainier (meuble haut à tiroirs) | Commodes et chiffonniers | 0 | non vérifiée |
| TAB-HAUTE — Table haute ou mange-debout | Tables | 4 | faible |
| TAB-6 — Table à manger 6 personnes | Tables | 1 | faible |
| TAB-4 — Table à manger 2 à 4 personnes | Tables | 2 | faible |
| CHA-PLIANTE — Chaise pliante | Chaises, tabourets et bancs | 2 | faible |
| CHA-ENF — Chaise ou fauteuil enfant | Mobilier et équipements pour enfants | 3 | faible |
| ENF-CHAISE-HAUTE — Chaise haute pour bébé | Mobilier et équipements pour enfants | 1 | faible |
| RAN-BUFFET-HAUT — Buffet haut ou vaisselier | Rangements du séjour (buffets, bibliothèques, vitrines, meubles TV) | 1 | faible |
| RAN-BIB-HAUTE — Bibliothèque haute | Rangements du séjour (buffets, bibliothèques, vitrines, meubles TV) | 4 | faible |
| RAN-SECRETAIRE — Secrétaire | Rangements du séjour (buffets, bibliothèques, vitrines, meubles TV) | 1 | faible |
| ETA-ECHELLE — Étagère échelle | Étagères et rayonnages | 0 | non vérifiée |
| ENT-MEUBLE — Meuble d'entrée | Meubles d'entrée | 0 | non vérifiée |
| CUI-ILOT — Îlot de cuisine | Mobilier de cuisine | 1 | faible |
| CUI-BUFFET — Buffet ou colonne de cuisine | Mobilier de cuisine | 0 | non vérifiée |
| CUI-ETAGERE — Étagère de cuisine ou micro-ondes | Mobilier de cuisine | 0 | non vérifiée |
| ELM-REF-US — Réfrigérateur américain | Gros électroménager | 0 | non vérifiée |
| ELM-REF-COMBI — Réfrigérateur combiné (congélateur en bas) | Gros électroménager | 0 | non vérifiée |
| ELM-REF-TOP — Réfrigérateur table top ou mini-réfrigérateur | Gros électroménager | 0 | non vérifiée |
| ELM-REF — Réfrigérateur | Gros électroménager | 0 | non vérifiée |
| ELM-CONG — Congélateur | Gros électroménager | 0 | non vérifiée |
| ELM-CAVE — Cave à vin | Gros électroménager | 0 | non vérifiée |
| ELM-LL — Lave-linge | Gros électroménager | 0 | non vérifiée |
| ELM-SL — Sèche-linge | Gros électroménager | 0 | non vérifiée |
| ELM-LV — Lave-vaisselle | Gros électroménager | 0 | non vérifiée |
| ELM-CUISINIERE — Cuisinière (four et plaques) | Gros électroménager | 0 | non vérifiée |
| ELM-FOUR — Four | Gros électroménager | 0 | non vérifiée |
| BUR-ASSIS — Bureau assis-debout | Mobilier de bureau | 2 | faible |
| BUR-ENFANT — Bureau enfant | Mobilier et équipements pour enfants | 0 | non vérifiée |
| BUR-REUNION — Table de réunion | Mobilier de bureau | 0 | non vérifiée |
| BUR-CAISSON — Caisson de bureau | Mobilier de bureau | 0 | non vérifiée |
| INF-TV-75 — Téléviseur 70 pouces et plus | Informatique, image et son | 0 | non vérifiée |
| INF-TV-55 — Téléviseur 50 à 65 pouces | Informatique, image et son | 0 | non vérifiée |
| INF-TV-43 — Téléviseur 40 à 49 pouces | Informatique, image et son | 0 | non vérifiée |
| INF-TV-32 — Téléviseur jusqu'à 39 pouces | Informatique, image et son | 0 | non vérifiée |
| INF-ENCEINTE — Enceinte colonne ou caisson de basses | Informatique, image et son | 3 | faible |
| INF-IMPRIMANTE — Imprimante ou multifonction | Informatique, image et son | 0 | non vérifiée |
| INF-ORDI — Ordinateur fixe, écran ou poste de travail | Informatique, image et son | 1 | faible |
| SDB-VASQUE — Meuble sous-vasque | Meubles de salle de bain | 3 | faible |
| SDB-ARMOIRE — Armoire de toilette ou meuble suspendu | Meubles de salle de bain | 2 | faible |
| SDB-COLONNE — Colonne de salle de bain | Meubles de salle de bain | 0 | non vérifiée |
| SDB-ETAGERE — Étagère de salle de bain | Meubles de salle de bain | 0 | non vérifiée |
| ENF-COFFRE — Coffre à jouets | Mobilier et équipements pour enfants | 0 | non vérifiée |
| ENF-POUSSETTE — Poussette | Mobilier et équipements pour enfants | 0 | non vérifiée |
| ENF-PARC — Parc ou lit parapluie | Mobilier et équipements pour enfants | 0 | non vérifiée |
| ENF-TABLE-LANGER — Table à langer | Mobilier et équipements pour enfants | 0 | non vérifiée |
| JAR-SALON — Salon de jardin (ensemble) | Mobilier et équipements de jardin | 0 | non vérifiée |
| JAR-TRANSAT — Bain de soleil ou transat | Mobilier et équipements de jardin | 3 | faible |
| JAR-TABLE — Table de jardin | Mobilier et équipements de jardin | 1 | faible |
| JAR-BALANCELLE — Balancelle, hamac ou fauteuil suspendu | Mobilier et équipements de jardin | 3 | faible |
| JAR-TONDEUSE — Tondeuse et matériel motorisé de jardin | Mobilier et équipements de jardin | 0 | non vérifiée |
| SPO-TAPIS-COURSE — Tapis de course | Équipements sportifs et de loisirs | 0 | non vérifiée |
| SPO-VELO-APPART — Vélo d'appartement ou elliptique | Équipements sportifs et de loisirs | 4 | faible |
| SPO-RAMEUR — Rameur | Équipements sportifs et de loisirs | 0 | non vérifiée |
| SPO-PINGPONG — Table de ping-pong | Équipements sportifs et de loisirs | 0 | non vérifiée |
| SPO-BABYFOOT — Baby-foot | Équipements sportifs et de loisirs | 1 | faible |
| SPO-BILLARD — Billard | Équipements sportifs et de loisirs | 0 | non vérifiée |
| SPO-TRAMPOLINE — Trampoline | Équipements sportifs et de loisirs | 0 | non vérifiée |
| SPO-SURF — Planche de surf ou paddle | Équipements sportifs et de loisirs | 0 | non vérifiée |
| SPO-SKI — Skis, snowboard et équipement de glisse | Équipements sportifs et de loisirs | 0 | non vérifiée |
| SPO-GOLF — Sac de golf | Équipements sportifs et de loisirs | 1 | faible |
| VEL-ADULTE — Vélo adulte | Vélos et engins à roues | 0 | non vérifiée |
| VEL-ENFANT — Vélo ou draisienne enfant | Vélos et engins à roues | 0 | non vérifiée |
| VEL-TROTTINETTE — Trottinette | Vélos et engins à roues | 0 | non vérifiée |
| MUS-PIANO-DROIT — Piano droit | Instruments de musique | 0 | non vérifiée |
| MUS-PIANO-QUEUE — Piano à queue | Instruments de musique | 0 | non vérifiée |
| MUS-PIANO-NUM — Piano numérique ou clavier | Instruments de musique | 0 | non vérifiée |
| MUS-GUITARE — Guitare, basse ou instrument à cordes | Instruments de musique | 3 | faible |
| MUS-BATTERIE — Batterie ou percussions | Instruments de musique | 1 | faible |
| DEC-PARAVENT — Paravent ou séparateur | Décoration volumineuse, luminaires et tapis | 1 | faible |
| DEC-PLANTE — Grande plante (artificielle ou en pot) | Décoration volumineuse, luminaires et tapis | 0 | non vérifiée |
| BRI-ETABLI — Établi | Bricolage, atelier et garage | 0 | non vérifiée |
| BRI-SERVANTE — Servante ou coffre à outils roulant | Bricolage, atelier et garage | 0 | non vérifiée |
| BRI-ARMOIRE-GARAGE — Armoire de garage ou d'atelier | Bricolage, atelier et garage | 2 | faible |
| BRI-COMPRESSEUR — Compresseur, groupe électrogène ou gros outillage | Bricolage, atelier et garage | 0 | non vérifiée |
| BAG-MALLE — Malle ou coffre | Bagages, malles et coffres | 1 | faible |
| BAG-SET — Ensemble de valises | Bagages, malles et coffres | 1 | faible |
| DIV-AQUARIUM — Aquarium ou terrarium | Objets particuliers (coffres-forts, aquariums, horloges…) | 0 | non vérifiée |
| DIV-HORLOGE-COMTOISE — Horloge comtoise ou de parquet | Objets particuliers (coffres-forts, aquariums, horloges…) | 0 | non vérifiée |
| CAR-SAC — Sac, ballot ou housse remplis | Cartons et contenants | 0 | non vérifiée |
| DIV-AUTRE — Objet non classé | Objets particuliers (coffres-forts, aquariums, horloges…) | 0 | non vérifiée |
| CAR-CARTON — Carton de déménagement | Cartons et contenants | 1 | faible |

## Contrôle manuel du classement

Deux tirages au sort de 60 observations utilisées dans les statistiques (graines 2026 et 77), vérifiées une à une le 25/11/2026 :

| Tirage | Correctes | Erreurs |
| --- | ---: | --- |
| 1 | 57 / 60 | canapé-lit (daybed) classé canapé 3 places par une règle de largeur ; fauteuil de direction classé fauteuil pivotant ; mini-four classé petit électroménager |
| 2 | 56 / 60 | deux séchoirs à linge classés étagère et portant ; un organiseur suspendu classé étagère ; une armoire classée meuble à chaussures |

Précision estimée du classement : **113 / 120, soit environ 94 %** (intervalle de confiance à 95 % : environ 88 à 97 %). Les sept erreurs ont été corrigées dans les règles (`taxonomie.py`) avant la construction finale ; la règle qui classait un canapé d'après sa largeur a été supprimée (un classement fondé sur la dimension fausserait les statistiques de la sous-catégorie).

## Limites connues

- **Volume géométrique ≠ volume de déménagement** : les statistiques portent sur la boîte englobante du produit monté. Le passage au volume facturé (démontage, empilement, calage) n'est jamais calculé automatiquement ; voir `architecture_catalogue.md`.
- **Largeur et profondeur** : ABO fournit « length » et « width » sans orientation garantie. Convention : largeur = plus grande dimension horizontale, profondeur = plus petite. Le volume n'en dépend pas.
- **Dimensions déclarées par les vendeurs** : certaines fiches donnent les dimensions du colis ; elles sont repérées quand le nom du produit annonce d'autres dimensions (« discordante »), sinon elles restent possibles. Les bornes de plausibilité en écartent une partie.
- **Marques** : ABO est dominé par les marques propres d'Amazon (Rivet, Stone & Beam, Ravenna Home, Movian, Solimo, AmazonBasics…). La diversité réelle des fabricants est donc faible ; voir `rapport_couverture.md`.
- **Objets transportés démontés ou repliés** (lits, tables, parasols, abris, tentes, tapis) : un avertissement accompagne la sous-catégorie.
