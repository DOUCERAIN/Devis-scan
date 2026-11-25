# Catalogue mobilier — registre des sources

Consultation : 24 novembre 2026. Fichiers : `data/catalog/catalog.json` (catalogue), `data/catalog/abo-provenance.json` (produits ABO utilisés par référence), script `scripts/catalog/build_catalog.py`.

## Sources intégrées

### 1. Amazon Berkeley Objects (ABO)
- **URL** : https://amazon-berkeley-objects.s3.amazonaws.com/index.html
- **Licence** : Creative Commons Attribution 4.0 International (CC BY 4.0), lue sur la page officielle et dans `LICENSE-CC-BY-4.0.txt` de l'archive.
- **Auteurs / crédit** : données « Amazon.com » ; jeu de données construit par M. Guillaumin, T. Dideriksen, K. Deng, H. Arora, A. Dhua, X. Zhang, T. Yago-Vicente (Amazon.com), J. Collins, S. Goel, J. Malik (UC Berkeley). Référence : Collins et al., « ABO: Dataset and Benchmarks for Real-World 3D Object Understanding », CVPR 2022.
- **Données importées** : uniquement l'archive de métadonnées `abo-listings.tar` (87 Mo). Aucune image, aucun modèle 3D téléchargé. Champs utilisés : nom anglais, type de produit, catégorie Amazon, dimensions, poids.
- **Modifications apportées** : sélection de produits par règles (catégorie, mots-clés, type, bornes de largeur), conversion en centimètres et kilogrammes, calcul de percentiles 10 / 50 / 90 par référence (dimensions, volume de la boîte englobante, poids), traduction des libellés par Devis Scan. Les fiches produits ne sont pas redistribuées : seules des statistiques agrégées et les identifiants des produits utilisés (traçabilité) le sont.
- **Mention d'attribution à afficher** : « Dimensions de référence calculées à partir d'Amazon Berkeley Objects (Amazon.com), CC BY 4.0, données agrégées et modifiées par Devis Scan. »

### 2. Table de volumes du prototype Devis Scan
- **Source** : `prototype/index.html` (propriété du porteur du projet).
- **Licence** : interne, aucune restriction.
- **Données importées** : 36 volumes de déménagement (m³) repris tels quels.
- **Limite** : origine des valeurs non documentée → fiabilité « moyenne », à confirmer avec des déménageurs.

### 3. Taxonomie et méthodes Devis Scan
Noms, catégories, synonymes, correspondances COCO, classes et coefficients de manutention, règles de dérivation des variantes : créations Devis Scan, documentées dans le script.

## Sources étudiées, non intégrées

| Source | Motif |
| --- | --- |
| **Grille AFDE** (guide UCANSS, déc. 2017, guideachats.ucanss.fr) | Document inaccessible depuis l'environnement de développement (site bloqué) ; grille non trouvée en accès libre (une recherche suggère qu'elle peut être réservée aux adhérents) ; conditions de réutilisation non établies. **Aucune valeur AFDE n'est intégrée.** Le champ `professional_volume_m3` est prévu et reste vide jusqu'à l'obtention d'un référentiel professionnel sous licence claire. |
| **COCO** (cocodataset.org) | Utilisé uniquement comme taxonomie (champ `coco_class` : chair, couch, bed, dining table, tv, oven, refrigerator, microwave, sink, bicycle…). Selon des sources secondaires (page officielle inaccessible), annotations sous CC BY 4.0 et images soumises aux conditions Flickr (licences variables, dont non commerciales). Aucune image ni annotation importée. |
| **Ultralytics YOLO** | Licence AGPL-3.0 ou licence Enterprise payante (README GitHub) : incompatible avec un SaaS propriétaire sans licence commerciale. Non utilisé. |
| **DETR, Grounding DINO** | Code sous Apache 2.0 (GitHub). Non utilisés à ce stade : architecture IA fondée sur un modèle multimodal (voir `docs/analyse-ia.md`). |
| **OWL-ViT / OWLv2** | Licence des poids non vérifiée (carte Hugging Face inaccessible). Non utilisé. |
| **Roboflow Universe** | Licences propres à chaque jeu de données ; pages inaccessibles depuis l'environnement. Non utilisé. |
| **Valdelia, annexe IV « Poids moyens mobilier » (2024)** | Volumes et poids de mobilier professionnel trouvés par recherche ; licence non établie. Non utilisé. |

Voir aussi `docs/catalogue-sans-volume.md` (52 références sans volume, traitement et pistes d'enrichissement).

## Fiabilité

- `dims_reliability` : `elevee` (≥ 30 produits ABO), `moyenne` (8 à 29), `aucune`.
- `moving_volume_reliability` : `moyenne` (référence interne du prototype), `faible` (dérivation ou coefficient de manutention, hypothèse à calibrer), `aucune` (volume vide, à renseigner par le déménageur : jamais de valeur inventée).

## Volumes : deux notions distinctes

- **Volume géométrique** : largeur × profondeur × hauteur (boîte englobante du produit monté), statistiques ABO.
- **Volume de déménagement** : volume utilisé pour le cubage et la tarification. Exemple mesuré : un lit queen size monté occupe en moyenne 4,48 m³ (géométrique), mais 1,4 m³ une fois démonté (référence interne).
