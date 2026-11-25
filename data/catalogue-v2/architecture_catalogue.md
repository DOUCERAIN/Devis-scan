# Architecture du catalogue Devis Scan v2

Document de conception. Rien n'est encore branché sur la base de données ni sur le moteur IA : les fichiers de `data/catalogue-v2/` sont **préparatoires**. L'ancien catalogue (`public.furniture_catalog`, 134 références) reste en service et n'est pas modifié.

## 1. Trois niveaux de données

```
Observations (catalogue_sources.csv)          une fiche produit d'une source, telle que publiée
      │  regroupement (même produit physique)
      ▼
Produits indépendants (produits_independants.csv)  un modèle physique (couleurs et pays confondus)
      │  classement + statistiques (médiane, Q1, Q3)
      ▼
Références normalisées (catalogue_devis_scan.csv / .json)  une sous-catégorie physique Devis Scan
```

- **Observation** : jamais modifiée ni supprimée. Elle garde ses dimensions d'origine, son unité, sa source, sa licence, sa date de collecte, et les contrôles qualité (complétude, plausibilité, lot, concordance avec le nom, fiabilité, motif d'exclusion éventuel).
- **Produit** : lien entre observations. Le regroupement ne détruit rien : chaque observation porte `id_produit` et `statut_regroupement` (produit unique / même produit / doublon potentiel).
- **Référence normalisée** : une sous-catégorie physique (ex. `ARM-2P`, armoire 2 portes), avec ses statistiques calculées sur les **modèles indépendants**, et la liste des produits utilisés (`produits_utilises`) et exclus (`produits_exclus`) pour remonter aux fiches d'origine.

## 2. Classification

- **Familles** (30) : `ARM` armoires, `CAN` canapés, `LIT` lits, `ELM` gros électroménager, `ANC` mobilier ancien, etc.
- **Sous-catégories** (197) : une différence **physique** qui change le volume ou l'aspect (nombre de portes, de places, de tiroirs, taille de couchage, diagonale…). Une sous-catégorie « … (non précisé) » (`-NC`) accueille les produits dont la fiche ne dit pas la caractéristique discriminante : ils ne sont jamais rangés d'office dans une sous-catégorie précise.
- **Variantes de taille** (`-C` compacte, `-S` standard, `-L` grande) : créées automatiquement quand une sous-catégorie compte au moins 15 modèles et que Q3 dépasse 1,8 × Q1 ; chaque variante regroupe un tiers des modèles, avec ses propres statistiques (111 variantes à ce jour). Exemple : `ARM-NC-C`, `ARM-NC-S`, `ARM-NC-L`.
- **Identifiants stables** : un identifiant publié ne change jamais. Une nouvelle distinction crée un nouvel identifiant (éventuellement avec `variante_de`).
- Règles de reconnaissance : `scripts/catalogue_v2/taxonomie.py` (motifs multilingues, exclusions des housses et accessoires, types de produit autorisés, bornes de plausibilité).

## 3. Statistiques et fiabilité

- Seules les observations **utilisables** comptent : source à réutilisation commerciale autorisée, 3 dimensions, dimensions dans les bornes de la sous-catégorie, pas un lot, pas de discordance avec le nom.
- Un produit = une valeur (médiane de ses observations utilisables) : un même canapé vendu dans cinq pays ne pèse qu'une fois.
- Valeurs aberrantes : règle de Tukey sur le logarithme du volume (IQR × 2), appliquée dès 8 modèles. Les produits écartés restent listés (`produits_exclus`).
- Statistiques : médianes de hauteur, largeur et profondeur ; volume médian, Q1, Q3, minimum, maximum ; dispersion relative (Q3 − Q1) / médiane ; nombre de modèles, de marques, d'observations.
- Fiabilité : **élevée** (≥ 15 modèles, ≥ 3 marques, dispersion ≤ 0,8), **moyenne** (≥ 5 modèles, ≥ 2 marques), **faible** (1 à 4 modèles ou une seule marque), **non vérifiée** (aucun modèle). Une médiane sur 1 à 4 modèles est une estimation provisoire, jamais une statistique représentative.

## 4. Volume géométrique et volume de déménagement

Deux notions distinctes, jamais converties automatiquement l'une en l'autre :

| Notion | Définition | Où |
| --- | --- | --- |
| Volume géométrique | hauteur × largeur × profondeur hors tout du produit monté (boîte englobante) | colonnes `volume_geometrique_*` |
| Volume de déménagement | volume retenu pour le cubage et le prix (démontage, empilement, calage, conventions de la profession) | colonne `volume_demenagement_reference_m3` |

Convention proposée pour le moteur de devis (à valider par le porteur du projet et des déménageurs) :

1. Le moteur de devis utilise **le volume de déménagement** quand il existe et qu'il a été validé.
2. Tant qu'il n'existe pas, le volume géométrique médian peut servir d'**estimation provisoire signalée** (« volume géométrique, à vérifier »). Il n'est jamais présenté comme un volume de déménagement.
3. Pour les objets transportés démontés ou repliés (lits, tables, parasols, abris, tentes, tapis), le champ `avertissement_volume` l'indique : le volume géométrique surestime alors le volume transporté.
4. Le volume de déménagement repris de l'ancien catalogue (prototype) est signalé comme tel (`volume_demenagement_origine`) : il n'a pas été recalculé.
5. Calibrage recommandé : relevés terrain de déménageurs (volume chargé par type d'objet) pour établir, sous-catégorie par sous-catégorie, un coefficient documenté.

## 5. Utilisation par n'importe quel fournisseur d'IA

Le catalogue est la **seule source des identifiants et des volumes**. Tous les modèles (Claude Haiku, Sonnet, un modèle open source ou un autre fournisseur) utilisent les mêmes identifiants. Le modèle ne renvoie jamais un volume.

```
1. Le modèle repère un objet sur les images et propose une FAMILLE (ex. ARM).
2. Le moteur lui fournit les sous-catégories candidates de cette famille, avec leurs
   caractéristiques discriminantes et leurs dimensions médianes (ex. ARM-1P … ARM-5P+, ARM-COUL, ARM-NC).
3. Le modèle choisit la sous-catégorie la plus proche (indices visuels, dimensions apparentes)
   et renvoie son IDENTIFIANT, avec un niveau de confiance et, s'il hésite, une seconde proposition.
4. Le serveur vérifie que l'identifiant existe (sinon : refus, objet « à préciser »).
5. Le serveur lit les dimensions et volumes de référence dans le catalogue.
6. Le moteur métier calcule le volume (règles validées : confirmé / à vérifier / potentiel).
7. Le prix est calculé exclusivement avec la grille de l'entreprise.
```

Règles :

- Hésitation entre deux sous-catégories : le modèle renvoie les deux identifiants, l'objet est « à confirmer » par le client ou le déménageur. Jamais de choix silencieux.
- Sous-catégorie `-NC` : volume de la sous-catégorie générale. Si une variante de taille existe, elle n'est choisie que sur des indices explicites (dimensions apparentes).
- Objet introuvable : `DIV-AUTRE`, dimensions demandées. Jamais de volume inventé.

### Contrat d'interface (indépendant du fournisseur)

Le contrat d'échange avec les modèles ne contient que :

- `famille` ;
- `sous_categorie` (identifiant) ;
- `alternatives` (identifiants) ;
- `confiance` ;
- les indices visuels.

Ajouter une sous-catégorie, une variante ou une statistique enrichit le catalogue **sans changer ce contrat**. Le texte remis au modèle (liste des sous-catégories candidates) est généré à partir du catalogue à chaque version.

### Versionnement

- Le catalogue porte un numéro de version (`version` dans le JSON). Chaque analyse enregistre la version utilisée, ce qui permet de rejouer une analyse avec une version ultérieure.
- La correspondance avec les 134 anciens identifiants (`correspondance_catalogue_existant.csv`) permet de migrer sans casser les inventaires existants : les anciens identifiants restent valides et pointent vers une référence normalisée principale.

## 6. Intégration future (non réalisée)

Rien de ce qui suit n'est encore fait :

1. table `catalog_references` (références normalisées) et table `catalog_observations` (provenance), alimentées par une migration non destructive ;
2. lien `furniture_catalog.id` → `catalog_references.identifiant` (correspondance) ;
3. génération du texte des candidats par famille pour les consignes IA ;
4. revue humaine des sous-catégories de fiabilité faible ou non vérifiée avant toute utilisation dans un devis.

## 7. Reconstruire le catalogue

```bash
# 1. Télécharger les sources (voir rapport_sources.md) dans data/catalogue-v2/cache/
# 2. Construire les observations, produits, références et la correspondance
python3 scripts/catalogue_v2/construire.py
# 3. Produire les rapports de qualité et de couverture, et la synthèse
python3 scripts/catalogue_v2/rapports.py
```
