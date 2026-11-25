# Rapport des sources — catalogue Devis Scan v2 (préparatoire)

Collecte réalisée le 25/11/2026 depuis l'environnement de développement de Devis Scan. Les chiffres détaillés (observations par source, marques, pays) sont dans `rapport_couverture.md` ; la synthèse chiffrée est dans `synthese.json`.

Principe appliqué : **une donnée n'est utilisée pour calculer un volume que si sa source autorise explicitement la réutilisation commerciale**. Une source dont les conditions sont incertaines ou contradictoires est conservée à titre documentaire, jamais présentée comme librement réutilisable. Aucune image n'a été téléchargée ni réutilisée. Aucune protection technique, authentification ou limitation d'accès n'a été contournée ; les limitations de débit de Wikidata ont été respectées (attentes, puis requêtes groupées moins nombreuses).

## 1. Sources exploitées pour les statistiques (réutilisation commerciale autorisée)

### 1.1 Amazon Berkeley Objects (ABO)

| Élément | Détail |
| --- | --- |
| Adresse | https://amazon-berkeley-objects.s3.amazonaws.com/index.html |
| Fichier utilisé | `archives/abo-listings.tar` (métadonnées seulement, 87 Mo, empreinte SHA-256 `b7f7ceac…44e3`), 147 702 fiches produit |
| Licence | Creative Commons Attribution 4.0 International (CC BY 4.0), lue dans le `README.md` et le fichier `LICENSE-CC-BY-4.0.txt` de l'archive |
| Réutilisation commerciale | **autorisée**, attribution obligatoire, modifications à signaler |
| Attribution | Données : « Amazon.com ». Construction du jeu : M. Guillaumin, T. Dideriksen, K. Deng, H. Arora (Amazon.com), J. Collins, J. Malik (UC Berkeley) |
| Mention à afficher | « Dimensions de référence calculées à partir d'Amazon Berkeley Objects (Amazon.com), CC BY 4.0, données agrégées et modifiées par Devis Scan. » |
| Champs utilisés | nom (toutes langues), marque, référence fabricant, type de produit, catégorie, pays, `item_dimensions` |
| Modifications | classement par Devis Scan, conversion en centimètres, contrôles de plausibilité, regroupement en produits, statistiques |
| Provenance de chaque observation | identifiant ASIN + domaine (`url_source` = page produit d'origine, qui peut avoir été retirée depuis) |
| Limites | marques propres d'Amazon très majoritaires ; dimensions saisies par les vendeurs (quelques colis, quelques erreurs d'unité, repérés et exclus) ; jeu figé (publié en 2022) ; très peu de gros électroménager |

### 1.2 Wikidata

| Élément | Détail |
| --- | --- |
| Adresse | https://query.wikidata.org (requêtes SPARQL), https://www.wikidata.org |
| Données | objets classés comme meubles (classe Q14745 et ses sous-classes) ayant au moins une dimension (largeur P2049, hauteur P2048, longueur P2043, profondeur P5524, épaisseur P2610, diamètre P2386), valeurs normalisées en mètres |
| Licence | CC0 1.0 (domaine public) pour les données structurées |
| Réutilisation commerciale | **autorisée** |
| Nature | surtout des meubles de musée ou de designer : dimensions réelles d'objets existants, utiles pour le **mobilier ancien** (armoires, commodes, buffets, coffres) |
| Exclusions | objets religieux, funéraires ou archéologiques (retables, autels, sarcophages, reliquaires…), hors périmètre d'un déménagement |
| Limites | limitation de débit sévère au moment de la collecte : récupération étalée, une partie des familles (pianos, horloges, électroménager) n'a pas pu être interrogée. Nombreuses fiches à 2 dimensions seulement (conservées, non utilisées pour le volume) |

## 2. Sources conservées à titre documentaire uniquement

### 2.1 ItemFits Open Catalog Database

| Élément | Détail |
| --- | --- |
| Adresse | https://itemfits.com/data/catalog (fichiers `download.csv` et `download.json`, version C-2 du 17/11/2026, 654 lignes) |
| Conditions | la page du catalogue indique « free to reuse with attribution », mais les conditions générales du site (https://itemfits.com/terms) interdisent de copier, modifier ou diffuser son contenu sans permission et tout usage commercial sans accord ou formule adaptée |
| Statut retenu | **réutilisation commerciale incertaine** : conditions contradictoires. Observations conservées (meubles, matelas, électroménager, IKEA), **exclues des statistiques** |
| Remarque | les lignes IKEA d'ItemFits citent les fiches IKEA elles-mêmes : leur réutilisation dépend aussi des conditions d'IKEA |
| Pour lever le doute | demander une autorisation écrite à ItemFits (support@itemfits.com) |
| Accès | robots.txt d'ItemFits consulté : les pages du catalogue sont autorisées aux robots |

## 3. Sources étudiées et non utilisées

| Source | Motif |
| --- | --- |
| **« Poché Furniture Dimensions »** | introuvable : aucune base sous ce nom n'a été trouvée par recherche web. Préciser l'adresse exacte si elle est connue |
| Bumblebee Furniture Database (Zenodo 17765286) | CC BY 4.0, mais il s'agit d'images stéréo de meubles (laboratoire Purdue), **sans dimensions** |
| « Hasil Crawling Produk Kursi IKEA » (Zenodo 3715432) | aspiration du site IKEA Indonésie publiée sous CC BY 4.0 par un tiers : **ne contient aucune dimension**, et la licence d'un tiers ne vaut pas autorisation d'IKEA |
| IKEA 3D Assembly Dataset (GitHub, IKEA) | CC BY-NC-SA 4.0 : **usage commercial interdit** ; 5 produits, dimensions seulement dans les modèles 3D |
| Présentations IKEA Knowledge Graph (Zenodo) | diapositives, pas de données exploitables |
| Bases Zenodo « furniture » | études ergonomiques (mobilier scolaire) : pas de catalogue commercial |
| 3D-FUTURE / 3D-FRONT, DUSt3R, etc. | licences non commerciales (connues, non téléchargées) |

## 4. Enseignes et fabricants demandés : non collectés

IKEA, Maisons du Monde, Conforama, BUT, La Redoute Intérieurs, Roche Bobois, Habitat, AM.PM, Cdiscount, ManoMano, Cuisinella, Schmidt, Mobalpa, Darty, Boulanger, Electrolux, Whirlpool, Bosch, Samsung, LG, Miele, ainsi que les petits fabricants et artisans.

Motifs :

1. **Accès** : ces sites ne sont pas joignables depuis l'environnement de développement (politique réseau). Je n'ai pas demandé leur ouverture : le point 2 s'y oppose de toute façon.
2. **Droit** : extraire systématiquement les fiches d'un site marchand relève du droit des producteurs de bases de données (Code de la propriété intellectuelle, art. L.342-1 et suivants), qui interdit l'extraction d'une partie substantielle sans autorisation. Les conditions d'utilisation de ces sites, **que je n'ai pas pu lire une par une**, encadrent en général l'usage automatisé et commercial. Une dimension isolée est une information factuelle, mais une collecte massive ne l'est plus.
3. **Images** : aucune image de ces sites ne doit être réutilisée.

Voies légales pour les intégrer :

- **accords de partenariat ou flux produits officiels** (flux d'affiliation, flux catalogue fournis par l'enseigne), avec une clause autorisant la réutilisation des dimensions ;
- **fiches techniques publiées par les fabricants**, relevées une à une à titre documentaire, avec l'accord du fabricant pour un usage commercial ;
- **mesures faites par les déménageurs partenaires** sur le terrain (la source la plus pertinente pour le volume réel de déménagement).

## 5. Source recommandée pour le gros électroménager : EPREL

La base européenne des étiquettes énergie (https://eprel.ec.europa.eu), gérée par la Commission européenne (DG Énergie), publie des fiches produit dont les **dimensions hors tout** (hauteur, largeur, profondeur en millimètres) sont obligatoires pour les appareils de froid (règlement délégué (UE) 2019/2016). Elle couvrirait le principal manque du catalogue (réfrigérateurs, congélateurs, caves à vin ; à vérifier pour les lave-linge et lave-vaisselle).

L'accès programmatique demande une **clé d'API publique gratuite**, à demander sur le site EPREL par Devis Scan. Cette clé n'a pas été demandée et EPREL n'a pas été interrogé. **À faire uniquement avec votre accord**, après lecture des conditions de réutilisation (politique de réutilisation des documents de la Commission).

## 6. Ancien catalogue Devis Scan (134 références)

`data/catalog/catalog.json`, **non modifié**. Ses volumes de déménagement viennent du prototype (table interne non documentée) et ses dimensions d'ABO (sélection précédente). Correspondance complète : `correspondance_catalogue_existant.csv`.
