# Catalogue Devis Scan v2 — fichiers préparatoires

Construit le 25/11/2026. **Aucune donnée n'est en base** : ces fichiers préparent le futur catalogue. L'ancien catalogue (`data/catalog/`, 134 références) n'est pas modifié.

| Fichier | Contenu |
| --- | --- |
| `catalogue_sources.csv` | base documentaire brute : toutes les observations collectées (y compris incomplètes, exclues ou documentaires), avec source, licence, statut de réutilisation, contrôles qualité. Séparateur « ; », UTF-8 |
| `produits_independants.csv` | produits physiques après regroupement des fiches (couleurs et pays confondus) |
| `catalogue_devis_scan.csv` | catalogue normalisé : familles, sous-catégories, variantes de taille, dimensions médianes, volumes (médiane, Q1, Q3, min, max), fiabilité |
| `catalogue_devis_scan.json` | même catalogue, format machine (moteur IA et moteur métier) |
| `correspondance_catalogue_existant.csv` | correspondance des 134 références actuelles avec les références normalisées |
| `rapport_sources.md` | sources, licences, conditions de réutilisation, sources écartées |
| `rapport_qualite.md` | complétude, fiabilité, exclusions, dispersion, références insuffisantes (généré) |
| `rapport_couverture.md` | couverture par famille, sous-catégorie, marque, pays, source (généré) |
| `architecture_catalogue.md` | classification, statistiques, volumes, utilisation par les fournisseurs d'IA |
| `synthese.json` | chiffres clés (généré) |
| `cache/` | sources brutes téléchargées (non versionnées, voir `.gitignore`) |

Reconstruction : `python3 scripts/catalogue_v2/construire.py` puis `python3 scripts/catalogue_v2/rapports.py`.

Attribution obligatoire pour toute diffusion : « Dimensions de référence calculées à partir d'Amazon Berkeley Objects (Amazon.com), CC BY 4.0, données agrégées et modifiées par Devis Scan. Données Wikidata, CC0. »
