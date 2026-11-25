# Rapport des sources — catalogue Devis Scan v3 (préparatoire)

Collecte réalisée le 25/11/2026 depuis l'environnement de développement. La v3 **reprend intégralement** les sources de la v2 (ABO, Wikidata, ItemFits — voir `data/catalogue-v2/rapport_sources.md`, toujours valable) et y ajoute quatre collections muséales dont les métadonnées sont publiées sous **CC0** (domaine public). Les chiffres sont dans `synthese.json` et `rapport_qualite.md`.

Principes appliqués :

- une donnée ne sert au calcul d'un volume que si sa source **autorise explicitement** la réutilisation commerciale ; l'accessibilité publique n'est jamais considérée comme une autorisation ;
- chaque observation porte sa source, son adresse, sa licence, sa date de collecte et un **niveau de droits** (colonne `niveau_droits`) :
  1. réutilisable commercialement (licence ouverte vérifiée) ;
  2. accessible, usage documentaire uniquement ;
  3. droits incertains, autorisation nécessaire ;
- aucune image n'a été téléchargée ni réutilisée ; aucun compte créé ; aucune clé demandée ; aucune entreprise contactée ; aucune protection contournée ; fréquences d'appel limitées (4 téléchargements simultanés au plus pour le Smithsonian, attentes respectées pour Wikidata) ;
- les fichiers bruts (plusieurs centaines de Mo) ne sont **pas** versionnés : seuls les scripts, les adresses, les licences et les empreintes le sont (`data/catalogue-v3/cache/` est ignoré par Git).

## 1. Sources de niveau 1 (statistiques)

| Source | Observations | Licence | Fichier et empreinte SHA-256 |
| --- | ---: | --- | --- |
| Amazon Berkeley Objects (ABO) — reprise v2 | 10 931 | CC BY 4.0 (attribution) | `abo-listings.tar`, `b7f7ceac…44e3` (cache v2) |
| Wikidata — reprise v2 | 1 167 | CC0 | requêtes SPARQL (cache v2) |
| Metropolitan Museum of Art | 4 851 | CC0 | `MetObjects.csv` (341 Mo), `39ebc006…c42e` |
| Smithsonian Open Access (musée national d'histoire américaine, Cooper Hewitt, SAAM, NPG, NASM) | 4 964 | CC0 (enregistrements CC0 seulement) | 1 274 fichiers d'index EDAN, présélection par mots-clés |
| Museum of Modern Art | 748 | CC0 | `Artworks.csv` (73 Mo), `7ec46cc5…1ad5` |
| Cleveland Museum of Art | 317 | CC0 (lignes « CC0 » seulement ; 26 182 lignes « Copyrighted » ignorées) | `data.csv` (132 Mo), `cbcbec43…c33c` |

Attributions à afficher (une attribution n'est obligatoire que pour ABO ; elle est recommandée pour les autres) :

- « Dimensions de référence calculées à partir d'Amazon Berkeley Objects (Amazon.com), CC BY 4.0, données agrégées et modifiées par Devis Scan. »
- « Données Wikidata, CC0. »
- « Métadonnées des collections du Metropolitan Museum of Art, du Museum of Modern Art, du Cleveland Museum of Art et du Smithsonian Open Access, CC0. »

### Détail des collections muséales

| Source | Adresse | Champs utilisés | Remarques |
| --- | --- | --- | --- |
| Met | https://github.com/metmuseum/openaccess (fichier LFS) | `Object Name`, `Title`, `Classification`, `Department`, `Object Date`, `Object Begin Date`, `Artist Display Name`, `Medium`, `Dimensions`, `Link Resource` | départements retenus : arts décoratifs européens, aile américaine, art moderne, instruments de musique, arts d'Asie et de l'Islam, collection Lehman, Moyen Âge, Cloisters. Dimensions en texte libre (« 35 1/4 x 23 1/2 x 20 in. (89.5 x 59.7 x 50.8 cm) »), centimètres préférés |
| MoMA | https://github.com/MuseumofModernArt/collection | `Title`, `Artist`, `Date`, `Medium`, `Height/Width/Depth/Diameter/Length (cm)`, `URL` | uniquement « Architecture & Design » / « Design » ; dimensions numériques étiquetées (aucun ordre supposé) |
| Cleveland | https://github.com/ClevelandMuseumArt/openaccess (`data.csv`, LFS) | `title`, `type`, `creation_date(_earliest)`, `creators`, `technique`, `measurements`, `url`, `share_license_status` | types retenus : mobilier et boiserie, instruments, outils, métal, bois, laque, pierre, textiles, divers |
| Smithsonian | https://www.si.edu/openaccess — fichiers publics `smithsonian-open-access.s3-us-west-2.amazonaws.com/metadata/edan/<unité>/` | titre, `Object Name`, types, dates, auteurs, `physicalDescription` (mesures), `guid` | unités téléchargées : NMAH (histoire américaine), CHNDM (Cooper Hewitt), SAAM, NPG, NASM. Six fichiers d'index NASM n'ont pas pu être lus (erreur réseau) : environ 2 % de cette unité manque. Enregistrements dont `metadata_usage.access` ≠ « CC0 » ignorés |

### Ce qui a été écarté à la lecture des collections

Les musées conservent surtout des œuvres et des objets sans rapport avec un déménagement. Ont été écartés (comptes exacts dans `rapport_qualite.md`) : maquettes, miniatures, jouets et mobilier de poupée, modèles de brevet, fragments et éléments de meuble (pieds, panneaux, poignées, plateaux seuls), gravures, dessins, photos, affiches, documents, enregistrements sonores, composants électroniques (tubes, bobines, cadrans), textiles (chemins de table, tissus), objets religieux et funéraires, armes, et les objets **nettement plus petits** que la sous-catégorie visée (miroir à main en bronze, lampe à huile antique…).

## 2. Sources de niveau 2 (documentaires)

| Source | Observations | Motif |
| --- | ---: | --- |
| ItemFits Open Catalog | 131 | page du catalogue « free to reuse with attribution », mais conditions générales interdisant toute réutilisation commerciale sans accord : conditions contradictoires. Conservées, **jamais utilisées dans les statistiques**. Aucun contact pris (consigne : ne contacter aucune entreprise) |

Aucune observation de niveau 3 n'a été enregistrée : les sources dont les droits sont incertains n'ont pas été collectées (voir § 3).

## 3. Sources étudiées en v3 et non utilisées

| Source | Statut | Motif |
| --- | --- | --- |
| Cooper Hewitt (dépôt GitHub `cooperhewitt/collection`) | CC0 | 215 000 fichiers JSON ; les mêmes objets sont publiés par le Smithsonian (unité CHNDM), utilisée à la place |
| Victoria and Albert Museum (API) | non joignable | hôte `api.vam.ac.uk` bloqué par la politique réseau de l'environnement ; non demandé |
| Art Institute of Chicago (API, CC0) | non joignable | hôte `api.artic.edu` bloqué ; non demandé |
| API Cleveland et API Met | non joignables | remplacées par les fichiers complets publiés sur GitHub (même contenu) |
| data.gouv.fr, data.europa.eu | non joignables | aucun jeu de dimensions de mobilier identifié par ailleurs ; à réexaminer si l'accès est ouvert |
| Hugging Face (jeux de données produits) | non joignable | jeux généralement issus d'aspirations de sites marchands : droits incertains, donc non retenus de toute façon |
| Open Products Facts | non joignable | base ODbL, peu de dimensions de meubles ; à réexaminer |
| **EPREL** (base européenne des étiquettes énergie) | clé d'API publique gratuite nécessaire | dimensions hors tout obligatoires pour les appareils de froid : source idéale pour le gros électroménager (le principal manque). **Aucune clé demandée** : l'obtention suppose une demande au nom de Devis Scan, à autoriser explicitement par le porteur du projet. Conditions à lire avant usage commercial |
| Sites d'enseignes et de fabricants | non collectés | droit des producteurs de bases de données (CPI L.342-1), conditions d'utilisation, et consigne de ne contacter aucune entreprise (inchangé depuis la v2) |
| Bases 3D (3D-FUTURE, ShapeNet, Objaverse…) | non retenues | licences non commerciales ou hétérogènes objet par objet ; modèles souvent sans échelle réelle |

## 4. Reconstruire

```bash
# 1. Sources v2 (ABO, Wikidata, ItemFits) : voir data/catalogue-v2/rapport_sources.md (cache v2, lu seulement)
# 2. Collections muséales, dans data/catalogue-v3/cache/musees/ :
curl -L -o data/catalogue-v3/cache/musees/MetObjects.csv https://media.githubusercontent.com/media/metmuseum/openaccess/master/MetObjects.csv
curl -L -o data/catalogue-v3/cache/musees/moma-Artworks.csv https://media.githubusercontent.com/media/MuseumofModernArt/collection/main/Artworks.csv
curl -L -o data/catalogue-v3/cache/musees/cma-data.csv https://media.githubusercontent.com/media/ClevelandMuseumArt/openaccess/master/data.csv
# 3. Smithsonian (présélection CC0, reprise possible après interruption)
python3 scripts/catalogue_v3/telecharger_smithsonian.py nmah chndm saam npg nasm
# 4. Construction puis rapports
python3 scripts/catalogue_v3/construire.py
python3 scripts/catalogue_v3/rapports.py
```

Les fichiers publiés évoluent : comparer les empreintes ci-dessus ; une nouvelle version donnera des chiffres légèrement différents.
