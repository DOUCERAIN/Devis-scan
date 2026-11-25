# Rapport des sources — catalogue Devis Scan v4 (préparatoire)

La v4 reprend toutes les sources de la v3 (ABO, Wikidata, Met, MoMA, Cleveland, Smithsonian, ItemFits documentaire — voir `data/catalogue-v3/rapport_sources.md`, toujours valable) et ajoute **ENERGY STAR**. Collecte du 26/11/2026. Aucun compte créé, aucune clé demandée, aucune entreprise contactée, aucune donnée payante.

## 1. Accès réseau demandés pendant la mission

L'environnement de développement bloquait toutes les sources publiques d'électroménager. Trois adresses ont été ajoutées à la liste autorisée (avec votre accord dans l'interface) : `eprel.ec.europa.eu` (lecture des pages publiques), `data.energystar.gov` (données), `edg.epa.gov` (lecture de la licence). Restent bloqués : data.gouv.fr, data.europa.eu, open.canada.ca, catalog.data.gov, Europeana, Rijksmuseum, et les autres hôtes cités en v3.

## 2. Nouvelle source : ENERGY STAR (niveau de droits 1)

| Élément | Détail |
| --- | --- |
| Éditeur | Agence américaine de protection de l'environnement (EPA), programme ENERGY STAR |
| Adresse | https://data.energystar.gov (API publique sans clé, `/resource/<id>.json`, paginée par 5 000, pauses de 2 s) |
| Licence | chaque jeu renvoie à https://edg.epa.gov/EPA_Data_License.html, lue le 26/11/2026 : « sauf mention contraire, les données produites par l'EPA sont dans le domaine public et ne sont pas protégées par le droit d'auteur (17 U.S.C. § 105) ». Le jeu des lave-vaisselle et celui des cuisinières affichent en plus « Public Domain ». Copie de la page : `cache/licences/EPA_Data_License.html` |
| Réutilisation commerciale | **autorisée** ; attribution non obligatoire (mention recommandée) ; aucune garantie de l'EPA |
| Nature | déclarations de certification des fabricants : un modèle = marque + référence, dimensions hors tout en pouces |
| Limite principale | modèles du marché **nord-américain** (souvent plus larges et plus hauts que les modèles européens : sèche-linge de 69 à 86 cm de large contre 60 cm en Europe) |

| Jeu (identifiant) | Modèles | Dimensions publiées | Utilisation | Empreinte SHA-256 |
| --- | ---: | --- | --- | --- |
| Réfrigérateurs résidentiels (`p5st-her9`) | 4 942 | hauteur, largeur | dimensions **partielles** (profondeur non publiée) | `82a9355d…9c18` |
| Congélateurs résidentiels (`8t9c-g3tn`) | 680 | aucune | non utilisé | `433e6fce…1061` |
| Lave-linge (`bghd-e2wd`) | 421 | H, L, P (souvent L seule) | complètes quand les 3 sont publiées | `1bb2c3b9…702a` |
| Sèche-linge (`t9u7-4d2j`) | 706 | H, L, P | complètes | `cb54f73a…7491` |
| Lave-linge séchants (`9jai-gs6t`) | 12 | H, L, P | complètes | `0c1e21b6…5a39` |
| Lave-vaisselle (`q8py-6w3f`) | 753 | largeur, profondeur | dimensions **partielles** (hauteur non publiée) | `c730a320…c4d5` |
| Cuisson électrique (`m6gi-ng33`) | 265 | H, L, P | cuisinières (165) ; plaques encastrées ignorées | `fff04cc2…832b` |

Jeux consultés et non retenus : téléviseurs (diagonale seulement), climatiseurs de fenêtre (pas l'équivalent du climatiseur mobile français), chauffe-eau (installation fixe), matériel professionnel.

## 3. EPREL (base européenne des étiquettes énergie) — étude, sans demande de clé

Constaté le 26/11/2026 :

- l'API de données répond **« Forbidden »** sans clé (`/api/products/refrigeratingappliances2019`) : une **clé d'API publique** est obligatoire pour toute consultation automatisée ; aucun export en masse sans clé n'a été trouvé ;
- le formulaire de demande (page « public API key ») demande : nom de l'organisation, représentant légal, demandeur, adresse e-mail, nom, adresse et description de l'application, acceptation des **conditions générales** et de la **déclaration de confidentialité**, et une **déclaration EPREL à télécharger** (probablement à signer) ;
- le texte des conditions générales est chargé dynamiquement par le site et n'a pas pu être lu depuis l'environnement : **les conditions de réutilisation commerciale restent à vérifier** avant toute utilisation ;
- intérêt : les fiches EPREL publient les dimensions hors tout (hauteur, largeur, profondeur) des réfrigérateurs, congélateurs, caves à vin, lave-linge, sèche-linge, lave-vaisselle et téléviseurs **vendus en Europe**. C'est exactement ce qui manque pour atteindre l'objectif de couverture.

Décision qui vous revient : demander ou non une clé au nom de Devis Scan (organisation, représentant légal, description de l'usage). Rien n'a été demandé.

## 4. Réexamen des données déjà téléchargées

- **ABO** : recherche ciblée des 41 sous-catégories prioritaires manquantes. Résultat : presque uniquement des accessoires (sacs de congélation, étendoirs « dryer », supports TV, housses, sauces « dressing »). Récupérés légitimement : de vrais **matelas** publiés sous d'autres types de produit, et 4 **téléviseurs** (axes réordonnés).
- **Wikidata** : électroménager presque absent (1 réfrigérateur, 2 lave-linge, aucun téléviseur, lave-vaisselle ni congélateur avec dimensions).
- **Musées** : objets anciens désormais exclus des sous-catégories actuelles (règle v4, voir `rapport_pertinence.md`).

## 5. Reconstruire

```bash
# Sources v2 et v3 : voir leurs rapport_sources.md (caches lus, jamais modifiés)
# ENERGY STAR, dans data/catalogue-v4/cache/energystar/<id>.jsonl (pages de 5 000, ordre :id)
curl -G "https://data.energystar.gov/resource/p5st-her9.json" --data-urlencode '$limit=5000' --data-urlencode '$offset=0' --data-urlencode '$order=:id'
python3 scripts/catalogue_v4/construire.py
python3 scripts/catalogue_v4/audit_dimensions.py
python3 scripts/catalogue_v4/rapports.py
```
