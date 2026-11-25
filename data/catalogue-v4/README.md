# Catalogue Devis Scan v4 — fichiers préparatoires

Construit le 26/11/2026. **Aucune donnée n'est en base**, rien n'est branché sur le moteur IA ni sur le parcours client. Les versions 2 (`data/catalogue-v2/`) et 3 (`data/catalogue-v3/`) restent intactes ; l'ancien catalogue (134 références) n'est pas modifié.

Nouveautés de la v4 : classement de **pertinence pour le déménagement** (4 niveaux), électroménager ENERGY STAR (domaine public), objets anciens exclus des statistiques des sous-catégories actuelles, médianes de **dimensions partielles**, audit séparé des **dimensions et volumes**, indicateur de **couverture métier**.

| Fichier | Contenu |
| --- | --- |
| `tableau_bord.md` | indicateurs v3 / v4 (généré) |
| `rapport_pertinence.md` | niveaux de pertinence, couverture par niveau, couverture pondérée, état des objets courants, sous-catégories prioritaires manquantes (généré) |
| `rapport_audit_dimensions.md` | contrôle des dimensions et des volumes, distinct du classement (généré) |
| `rapport_qualite.md`, `rapport_couverture.md` | qualité des observations, couverture par sous-catégorie (générés) |
| `rapport_sources.md` | sources, licences, EPREL, reconstruction (rédigé) |
| `architecture_catalogue.md` | ajouts de la v4 à l'architecture v3 (rédigé) |
| `PROGRESSION.md` | état d'avancement et pistes (rédigé) |
| `catalogue_sources.csv` + `observations/` | toutes les observations, une par fiche, découpées par famille |
| `produits_independants.csv` | modèles physiques |
| `catalogue_devis_scan.csv` / `.json` | catalogue normalisé (avec `pertinence`, `niveau_pertinence`, `couverture_dimensions`, `dimensions_partielles`) |
| `correspondance_catalogue_existant.csv` | correspondance des 134 références actuelles |
| `synthese.json` | chiffres clés (généré) |

Reconstruction : `python3 scripts/catalogue_v4/construire.py`, puis `audit_dimensions.py`, puis `rapports.py` (sources : `rapport_sources.md`).

Attributions : « Dimensions de référence calculées à partir d'Amazon Berkeley Objects (Amazon.com), CC BY 4.0, données agrégées et modifiées par Devis Scan. Données Wikidata, CC0. Métadonnées des collections du Metropolitan Museum of Art, du Museum of Modern Art, du Cleveland Museum of Art et du Smithsonian Open Access, CC0. Dimensions d'électroménager issues des listes ENERGY STAR de l'EPA (domaine public). »
