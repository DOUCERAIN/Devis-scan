# Catalogue Devis Scan v5 — fichiers préparatoires

Construit le 27/11/2026, **sans nouvelle collecte** : consolidation des données v2 à v4 (caches relus, jamais modifiés). Aucune donnée en base, rien n'est branché sur le moteur IA ni sur le parcours client. Les versions 2, 3 et 4 sont intactes.

Nouveautés : corrections de dimensions justifiées et traçables, statut d'orientation, exclusion des modules et des colis à plat, dimensions médianes sur les seules orientations fiables, mesurabilité et champs de transport (sans coefficient), deux dénominateurs de couverture, étude EPREL et intégration préparée.

| Fichier | Contenu |
| --- | --- |
| `tableau_bord.md` | indicateurs v4 / v5 (généré) |
| `rapport_audit_dimensions.md` + `audit/` | audit des dimensions et volumes, contrôle manuel de 100 observations, listes détaillées (généré) |
| `rapport_pertinence.md` | indicateurs de couverture métier, deux dénominateurs, mesurabilité (généré) |
| `rapport_sous_categories_manquantes.md` | dossier des 39 sous-catégories prioritaires sans trois dimensions (généré) |
| `rapport_eprel.md` | conditions officielles d'EPREL et démarches à effectuer (rédigé) |
| `rapport_sources.md`, `architecture_catalogue.md`, `PROGRESSION.md` | sources, architecture, avancement (rédigés) |
| `rapport_qualite.md`, `rapport_couverture.md`, `rapport_correspondance.md` | qualité, couverture, 134 références historiques (générés) |
| `catalogue_sources.csv` + `observations/` | toutes les observations (index + un fichier par famille) |
| `produits_independants.csv`, `catalogue_devis_scan.csv` / `.json`, `correspondance_catalogue_existant.csv`, `synthese.json` | données |

Reconstruction : `python3 scripts/catalogue_v5/construire.py`, puis `audit_dimensions.py`, puis `rapports.py`. Sources et empreintes : `rapport_sources.md`.
