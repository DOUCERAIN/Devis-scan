# Rapport des sources — catalogue Devis Scan v5 (préparatoire)

**Aucune nouvelle observation en v5** : les sources sont celles de la v4 (ABO, Wikidata, Met, MoMA, Cleveland, Smithsonian, ENERGY STAR ; ItemFits documentaire). Leurs licences, empreintes et procédures de téléchargement sont décrites dans `data/catalogue-v2/`, `data/catalogue-v3/` et `data/catalogue-v4/rapport_sources.md`, toujours valables. Les caches v2 à v4 sont relus, jamais modifiés.

## Recherches menées en v5 (27/11/2026)

| Source | Résultat |
| --- | --- |
| ABO (réexamen ciblé des 39 sous-catégories prioritaires manquantes) | aucun nouveau produit utilisable : résultats = accessoires (« freezer bags », « dryer sheets », supports TV, housses, sauces « dressing ») |
| ENERGY STAR (catalogue complet, 90 jeux) | aucun jeu supplémentaire utile : congélateurs sans dimensions, téléviseurs à diagonale seule, chauffe-eau et matériel professionnel hors périmètre |
| Wikidata (électroménager, poussettes, tapis de course, tondeuses) | 0 à 2 objets avec dimensions par classe |
| Zenodo (recherches « EPREL », « refrigerator dimensions », « furniture dimensions », etc.) | 3 jeux récents dérivés d'EPREL (CC BY 4.0) : agrégats de consommation et capacités, **aucune dimension par modèle**. Utiles seulement comme indications de tiers sur les conditions EPREL |
| EPREL (Commission européenne) | clé obligatoire ; procédure, champs et limites étudiés dans `rapport_eprel.md` |

## Accès réseau ajoutés pendant la mission

Avec votre accord dans l'interface : `ec.europa.eu`, `webgate.ec.europa.eu`, `energy-efficient-products.ec.europa.eu` (lecture des textes officiels EPREL). En v4 : `eprel.ec.europa.eu`, `data.energystar.gov`, `edg.epa.gov`. Toujours bloqués : data.gouv.fr, data.europa.eu, open.canada.ca, catalog.data.gov, Europeana, Rijksmuseum.

## Copies de référence (non versionnées, `cache/`)

- `cache/eprel/` : configuration et textes officiels du site EPREL (fichiers de traduction anglais), page du portail.
- `cache/zenodo/` : métadonnées et archive EarlyDex consultées.
