# Audit des dimensions et des volumes — catalogue Devis Scan v5

Généré par `scripts/catalogue_v5/audit_dimensions.py`. Listes détaillées (une ligne par observation, valeurs d'origine et corrigées) dans `audit/`. **Cet audit porte sur les valeurs, pas sur le classement des objets.**

## Règles de correction

Aucune dimension n'est permutée parce qu'elle paraît inhabituelle. Une correction exige une information vérifiable de la même source ; elle conserve les dimensions d'origine (`dimensions_v4_cm`), le motif (`correction_v5`), la méthode (`methode_verification`), la source (`source_justificative`) et la confiance (`confiance_correction`). Sans certitude, l'observation est marquée **ambiguë** : elle reste dans la base et dans les statistiques de **volume** (qui ne dépendent pas de l'orientation), mais pas dans les **dimensions médianes**.

| Méthode | Confiance | Corrections |
| --- | --- | ---: |
| hauteur écrite dans le nom (« 36"H », « 42 Inch Height ») ou ordre écrit (« L x W x H », « largo x ancho x alto ») | élevée | 70 (dont 4 téléviseurs vérifiés par la diagonale) |
| dimensions du nom égales aux dimensions publiées × 10 ou × 2,54 | élevée | 2 |
| trois dimensions annoncées dans le nom, différentes de la fiche (colis ou saisie erronée) | moyenne | 79 |

Garde-fous ajoutés après le contrôle manuel : « High Gloss » n'est pas une hauteur ; une hauteur écrite incompatible avec la sous-catégorie (« meuble TV 59"H ») est traitée comme une coquille (observation ambiguë, pas de correction) ; les tables extensibles (« 160-240 ») ne sont pas remplacées.

## 1. Orientation (ordre hauteur / largeur / profondeur)

Méthode v5 : rang de la hauteur (plus petite, intermédiaire ou plus grande des trois dimensions) comparé au rang dominant de la sous-catégorie (≥ 80 % des modèles, ≥ 5 modèles). Plus fiable que le rapport hauteur/largeur de la v4 : un tapis plus épais ou une armoire plus large ne sont plus signalés.

| Statut (observations à 3 dimensions) | Observations |
| --- | ---: |
| non évaluable | 7 951 |
| conforme à la forme dominante | 5 586 |
| vérifiée | 3 760 |
| ambiguë | 1 121 |
| corrigée | 70 |

- **vérifiée** : hauteur étiquetée par la source (ENERGY STAR, MoMA, Wikidata P2048, musées avec lettres H/L/P) ou écrite dans le nom ; **conforme** : même forme que la majorité des modèles ; **non évaluable** : pas de forme dominante (tables d'appoint, cadres, objets carrés) ou dimensions incomplètes.
- **Ambiguës : 1 121** (dont 339 encore utilisées pour le volume), contre 1 652 « orientations suspectes » en v4 (8,9 %) avec l'ancien critère — commerce (ABO) : 719, musées et Wikidata : 385, documentaire (ItemFits) : 17.
  - `ANC-ARMOIRE` CMA — Wardrobe (Kast) : 170.8 × 193.0 × 89.0 cm
  - `ANC-ARMOIRE` CMA — Upper Paneling from a Sacristy Armoire : 160.0 × 476.0 × 69.2 cm
  - `ANC-CANAPE` MET — Settee : 214.6 × 149.9 × 56.5 cm
  - `ANC-CANAPE` MET — Windsor Settee : 119.4 × 99.1 × 36.8 cm
  - `ANC-CANAPE` SMITHSONIAN — sofa : 96.5 × 154.9 × 137.2 cm
  - `ANC-CANAPE` SMITHSONIAN — sofa, cloverleaf : 91.4 × 15.2 × 15.2 cm
- Contrôle manuel (voir § 7) : une ambiguïté n'est pas une erreur. Sur 35 fiches ambiguës relues, 3 seulement avaient une orientation réellement fausse ; les autres étaient des formes atypiques réelles (canapé à dossier haut, fauteuil bas, pouf haut). D'où le choix de ne rien permuter sans preuve.

## 2. Unités

- Erreurs d'unité probables : 1 138 en v4 → **1 123** en v5 ; 2 corrigées par le nom du produit (× 10, × 2,54), les autres conservées telles quelles et exclues — musées et Wikidata : 784, commerce (ABO) : 288, électroménager (ENERGY STAR) : 47, documentaire (ItemFits) : 4.
- Pour les musées, la plupart sont des objets hors normes (armoire de 3 m) ou des éléments isolés : le détecteur est une hypothèse, pas une preuve.

## 3. Colis, dimensions intérieures, meubles à plat, produits modulaires

- Discordance entre la fiche et les dimensions du nom : 457 en v4 → **443** en v5 (les fiches à trois dimensions dans le nom ont été corrigées, méthode C).
- **Profil de colis à plat** (dimension minimale < 15 cm et < 35 % de la sous-catégorie, volume < 40 %, sans dimensions annoncées dans le nom, lits exclus car les lits plateformes sont réellement bas) : **125** fiches, **exclues des statistiques** et listées pour vérification (v4 : 230 signalées, non exclues).
  - `ARM-NC` ABO — UMI.3D Adhésif électrostatique Films pour Fenêtre pour Armoire de Port : 0.3 × 200.0 × 60.0 cm
  - `ARM-NC` ABO — AmazonBasics - Mensola da armadio a 6 ripiani, in tela rinnovata : 30.5 × 30.5 × 5.1 cm
  - `ARM-NC` ABO — AmazonBasics - Mensola per armadio a 10 ripiani (rinnovata) 1-Pack Del : 30.5 × 15.2 × 6.3 cm
  - `ARM-PORT` ABO — AmazonBasics Garment Rack, Chrome : 90.2 × 57.1 × 8.9 cm
  - `ARM-PORT` ABO — AmazonBasics Leaning Garment Rack, Silver : 64.0 × 34.5 × 2.2 cm
  - `ARM-PORT` ABO — AmazonBasics Leaning Garment Rack, Black : 64.0 × 34.5 × 2.2 cm
- **Produits modulaires** (élément de canapé modulable, module) : **29** fiches exclues (dimensions d'un module, pas du meuble).
- **Dimensions intérieures** : non utilisées. ENERGY STAR publie la capacité intérieure (pieds cubes) dans un champ séparé, jamais pris pour une dimension ; les musées sont lus sur la mesure « overall » (hors tout) quand elle existe.
- **Appareils encastrables** : signalés dans `commentaires` (ENERGY STAR « built-in »), dimensions de l'appareil seul, jamais celles du meuble qui l'accueille.

## 4. Valeurs aberrantes

- Modèles écartés par la règle de Tukey (logarithme du volume, écart interquartile × 2, dès 8 modèles) : 236 en v4 → **230** en v5 (`audit/modeles_aberrants.csv`). Ils restent listés dans `produits_exclus`.

## 5. Volumes géométriques

- Recalcul H × L × P : **0** écart. Ordre min ≤ Q1 ≤ médiane ≤ Q3 ≤ max : **0** incohérence. Produits de variante étrangers à leur sous-catégorie : **0**.
- Les dimensions médianes sont calculées sur les seuls modèles d'orientation fiable (`nb_modeles_orientation_fiable`) ; le volume médian sur tous les modèles utilisables.

## 6. Objets anciens

- 447 objets de musée exclus des statistiques des sous-catégories actuelles (règle v4 maintenue).

## 7. Contrôle manuel (27/11/2026) — trois indicateurs distincts

Échantillon de **100 observations** (graine 2711, `audit/echantillon_controle_manuel.tsv`), volontairement orienté vers les cas difficiles : 35 orientations ambiguës, 30 fiches corrigées, 35 observations utilisables de sous-catégories courantes. Chaque fiche a été relue à la main, deux fois : avant et après les garde-fous ci-dessus.

| Indicateur | Avant garde-fous | Après garde-fous | Ce qu'il mesure |
| --- | ---: | ---: | --- |
| Classement correct de l'objet | 96 / 100 | 96 / 100 | la sous-catégorie attribuée correspond à l'objet (erreurs : lit avec tête de lit classé « tête de lit », « lamp table » classée lampe, table de jardin classée table de repas, tapisserie classée meuble ancien) |
| Plausibilité des dimensions (valeurs et orientation enregistrées) | 92 / 100 | 96 / 100 | les trois dimensions, dans l'ordre enregistré, sont plausibles pour l'objet monté |
| Fiabilité du volume géométrique | 98 / 100 | 98 / 100 | le produit H × L × P correspond au meuble monté (pas au colis) |
| Corrections justes (sous-ensemble de 30 fiches corrigées) | 28 / 30 | 30 / 30 | « 69 cm High Gloss » lu comme une hauteur, coquille « 59"H » : supprimées par les garde-fous |

Erreurs restantes relevées : miroir mural « 16" x 20" » publié 55 × 64 × 31 cm (dimensions de carton probables, encore utilisées) ; fauteuil à oreilles profond de 96 cm pour 81 cm de large annoncés (doute) ; déshumidificateur à hauteur et profondeur inversées et étagère « Kairo » (marqués ambigus, exclus des dimensions médianes).

Ces taux portent sur un échantillon **orienté vers les cas difficiles** : ils ne s'extrapolent pas à tout le catalogue (le contrôle aléatoire v4 donnait 87 / 90 dimensions plausibles). Ils ne mesurent pas le volume de déménagement.
