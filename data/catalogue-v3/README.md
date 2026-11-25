# Catalogue Devis Scan v3 — fichiers préparatoires

Construit le 25/11/2026. **Aucune donnée n'est en base**, rien n'est branché sur le moteur IA ni sur le parcours client. La v2 (`data/catalogue-v2/`) reste intacte ; l'ancien catalogue (`data/catalog/`, 134 références) n'est pas modifié.

| Fichier | Contenu |
| --- | --- |
| `catalogue_sources.csv` | **index** des observations : un fichier par famille dans `observations/` (nombre d'observations et d'observations utilisables) |
| `observations/catalogue_sources_<FAMILLE>.csv` | base documentaire brute : toutes les observations (y compris incomplètes, exclues, documentaires), avec source, adresse, licence, niveau de droits, date, dimensions d'origine et normalisées, contrôles qualité, variante. Séparateur « ; », UTF-8 |
| `produits_independants.csv` | modèles physiques après regroupement (couleurs, pays et exemplaires de musée confondus) |
| `catalogue_devis_scan.csv` / `.json` | catalogue normalisé : 46 familles, sous-catégories, variantes de taille, dimensions médianes, volumes (médiane, Q1, Q3, min, max), dispersion, fiabilité, part des objets de collection |
| `correspondance_catalogue_existant.csv` | correspondance des 134 références actuelles |
| `rapport_sources.md` | sources, licences, niveaux de droits, sources écartées, reconstruction (rédigé) |
| `rapport_qualite.md` | complétude, fiabilité, exclusions, contrôle manuel (généré) |
| `rapport_couverture.md` | couverture par sous-catégorie, sous-documentation, marques (généré) |
| `tableau_bord.md` | indicateurs v2 / v3 et par famille (généré) |
| `architecture_catalogue.md` | classification, statistiques, volumes, usage par tout fournisseur d'IA (rédigé) |
| `PROGRESSION.md` | état d'avancement, limites, prochaines pistes (rédigé) |
| `synthese.json` | chiffres clés (généré) |
| `cache/` | sources brutes (non versionnées) |

Reconstruction : `python3 scripts/catalogue_v3/construire.py` puis `python3 scripts/catalogue_v3/rapports.py` (sources à télécharger : `rapport_sources.md` § 4).

Attributions : « Dimensions de référence calculées à partir d'Amazon Berkeley Objects (Amazon.com), CC BY 4.0, données agrégées et modifiées par Devis Scan. Données Wikidata, CC0. Métadonnées des collections du Metropolitan Museum of Art, du Museum of Modern Art, du Cleveland Museum of Art et du Smithsonian Open Access, CC0. »
