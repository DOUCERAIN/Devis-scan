> **Rapport de la v6.0, remplacé par `rapport_final_v6_1.md`.** Plusieurs chiffres ci-dessous ne sont plus à jour (carton, sources, volumes). Conservé pour l'historique.

# Catalogue v6 — rapport d'avancement chiffré

**Date** : 26/11/2026.

**Espace de travail séparé** : `data/catalogue-v6/` et `scripts/catalogue_v6/`.

**Ce qui n'a pas été modifié** : le moteur de devis, le moteur IA, le parcours client, Supabase, la production, et le catalogue v5 (relu seulement ; ses mesures brutes restent intactes).

**Reconstruction** : `python3 scripts/catalogue_v6/enrichir.py`. Contrôles : `python3 -m unittest scripts/catalogue_v6/test_enrichir.py` (13 tests réussis).

---

## 1. Résultats par objectif

| Objectif | Cible | Résultat | Atteint ? |
| --- | --- | --- | --- |
| 1. Volume numérique ou exception documentée, 311 sous-catégories | 100 % | **311 / 311** : 310 volumes et 1 exception (`DIV-AUTRE`, objet non classé) | oui |
| 1. Volume utilisable, 226 prioritaires (niveaux 1 et 2) | 100 % | **225 / 226** et l'exception `DIV-AUTRE` | oui |
| 1. Aucun objet important à volume nul sans signalement | 0 | 0 | oui |
| 1. Catégories rares traitées | toutes | 85 sous-catégories de niveaux 3 et 4 ont un volume (81 par analogie, 3 avec un relevé, 1 par comparable) | oui, en provisoire |
| 2. Référence documentée (au moins une mesure de produit ou deux relevés de déménageurs), prioritaires | 95 % | **179 / 226 = 79 %**. En comptant aussi les relevés uniques : 188 / 226 = 83 % | **non** |
| 2. Fiabilité géométrique selon les nouveaux seuils (sous-catégories mesurées) | — | 74 élevées, 71 moyennes, 83 provisoires, sur 228 mesurées. Prioritaires : 60 / 47 / 59 sur 166 | — |
| 3. Médiane des volumes individuels, P25, P75, dispersion, valeurs aberrantes, nombre de modèles et de sources | toutes les sous-catégories mesurées | 228 sous-catégories. Médianes reprises de la v5, qui suivait déjà cette méthode : jamais le produit des dimensions médianes. 9 958 mesures individuelles conservées dans `mesures_individuelles.csv` | oui |
| 4. Volume de déménagement distinct du géométrique | 311 | 311 : deux colonnes, deux méthodes, deux statuts | oui |
| 4. Volume de déménagement fondé sur des données de déménageurs | — | **39** sous-catégories avec au moins 2 relevés publics (7 de fiabilité moyenne) ; **31** avec un seul relevé combiné à une proposition ; **240** provisoires sans relevé | partiel |
| 5. Traçabilité intégrale | 311 | 30 champs par sous-catégorie ; 6 fichiers de sources (§ 6) | oui |
| 6. Part du volume d'inventaires pilotes ayant une référence numérique | 98 % | **100 %** de référence numérique sur 3 inventaires types et 3 pièces du banc. **Aucun inventaire pilote réel n'existe encore** : à refaire dès qu'il y en aura | oui sur données types, à confirmer |
| 7. Aucune estimation présentée comme une mesure | 0 | 0 (contrôlé par test) | oui |

### Ce que « 100 % de couverture » veut dire ici

Toutes les sous-catégories ont désormais un nombre utilisable, mais **la plupart de ces nombres sont provisoires**.

| Statut d'ensemble | Toutes (311) | Prioritaires (226) |
| --- | ---: | ---: |
| **Vérifié** (validé par un déménageur pilote) | **0** | **0** |
| **Estimé** (géométrique mesuré et au moins 2 relevés de déménageurs) | 31 | 31 |
| **Provisoire** | 279 | 194 |
| Exception documentée | 1 | 1 |

Part du volume des inventaires types fondée sur au moins 2 relevés de déménageurs :

| Logement type | Volume | Part sur ≥ 2 relevés | Part sur comparable | Part sur analogie ou relevé unique |
| --- | ---: | ---: | ---: | ---: |
| Studio / T1 | 12,7 m³ | **84 %** | 2 % | 14 % |
| T3 familial | 27,9 m³ | **72 %** | 1 % | 27 % |
| Maison 5 pièces avec jardin | 67,6 m³ | **53 %** | 11 % | 36 % |

Les sous-catégories les plus fréquentes (armoires 2 à 4 portes, canapés, lits, réfrigérateurs, lave-linge, tables, chaises) sont celles qui ont des relevés. Les maisons, avec leur garage, leur jardin et leur matériel de sport, dépendent davantage des estimations.

---

## 2. Constat principal : l'ancien catalogue sous-estime les volumes

Sur les 3 inventaires types, à objets identiques, les volumes v6 dépassent de **52 à 55 %** les volumes de déménagement hérités de l'ancien catalogue. C'est celui qu'utilise le moteur de devis actuel, et il venait du premier prototype, sans source.

| Logement type (objets présents dans les deux catalogues) | Ancien catalogue | v6 | Écart |
| --- | ---: | ---: | ---: |
| Studio / T1 | 8,2 m³ | 12,5 m³ | **+52 %** |
| T3 familial | 14,9 m³ | 22,9 m³ | **+54 %** |
| Maison 5 pièces | 35,2 m³ | 54,6 m³ | **+55 %** |

**Exemples où l'ancienne valeur est même inférieure au volume du meuble lui-même**, ce qui est impossible pour un objet rigide (19 cas signalés) :

| Objet | Ancien | Volume géométrique médian | Proposition v6 |
| --- | ---: | ---: | ---: |
| Lave-linge | 0,3 m³ | 0,53 m³ | 0,5 m³ |
| Réfrigérateur | 0,4 m³ | 0,90 m³ | 0,93 m³ |
| Combiné | 0,4 m³ | — | 1,17 m³ |
| Sèche-linge | 0,3 m³ | 0,52 m³ | 0,53 m³ |
| Armoire 4 portes | 1,2 m³ | 2,17 m³ | 4,0 m³ (relevés) |

**Contrôle de vraisemblance** (indicatif). Les déménageurs publient une règle courante : volume ≈ surface habitable ÷ 2, ou × 0,4. Pour un T3 de 65 m², cela donne 26 à 33 m³ cartons compris. Le T3 type fait 27,9 m³ en v6 sans les cartons, contre environ 15 à 18 m³ avec l'ancien catalogue.

**Conséquence.** Tant que le moteur de devis garde l'ancien catalogue, les devis risquent d'être sous-évalués. **Le catalogue v6 n'est pas branché**, et rien n'a été changé dans le moteur. La décision vous revient (§ 5, décision 1).

---

## 3. Méthode

### 3.1 Volume géométrique (boîte englobante du meuble monté)

| Statut | Nombre (prioritaires) | Méthode |
| --- | ---: | --- |
| **Mesuré** | 228 (166) | médiane des volumes individuels de chaque produit (hauteur × largeur × profondeur), aberrants exclus sur l'échelle logarithmique ; P25 et P75 ; v5, sans changement |
| **Partiellement mesuré** | 7 (7) | réfrigérateurs, cave à vin, lave-vaisselle, psyché : hauteur et largeur médianes mesurées sur 45 à 1 430 modèles, profondeur estimée par l'IA. Produit des dimensions d'un modèle type, **pas une médiane** |
| **Estimé (IA)** | 75 (52) | dimensions d'un modèle type courant, fixées par l'IA, avec une fourchette entre petit et grand modèle (`estimations_ia.csv`). **Aucune mesure** |
| Aucun | 1 | `DIV-AUTRE` (exception) |

**Seuils de fiabilité** (tels que demandés) :

| Fiabilité | Produits indépendants | Sources distinctes |
| --- | ---: | ---: |
| Élevée | ≥ 10 | ≥ 3 |
| Moyenne | ≥ 5 | ≥ 2 |
| Provisoire | en dessous | en dessous |

**Adaptation à la dispersion** : si l'écart entre P25 et P75 dépasse la médiane, on descend d'un niveau.

**Définition d'une « source distincte »** (choix à valider) : la marque ou le fabricant pour un produit du commerce, sinon la base documentaire (musée, Wikidata).

**Volume de transport** : 11 sous-catégories ont un volume mesuré ou estimé à l'état **déployé**, sans rapport avec le déménagement. Exemples :
- parasol ouvert : 15 m³ ;
- abri monté : 27 m³ ;
- tente montée : 2,7 m³.

Elles reçoivent en plus un **volume de transport** estimé (plié ou démonté). Le volume déployé est conservé.

### 3.2 Volume de déménagement de référence

Chaque sous-catégorie suit **la première règle applicable** :

1. **Au moins 2 relevés publics de déménageurs** : médiane des relevés. Statut « estimé » ; fiabilité « moyenne » seulement avec au moins 3 sources et un écart maximal de 1 à 3. **39** sous-catégories.
2. **Sous-catégorie comparable** (`comparables.py`, 30 cas justifiés un par un). On reprend le volume d'une sous-catégorie de même nature qui a des relevés, en proportion des volumes géométriques ou avec un facteur explicite. Exemples :
   - canapé 2 places ← canapé 3 places ;
   - lit king ← lit queen × 1,15 ;
   - lit superposé ← 2 lits simples.

   On l'utilise quand le géométrique mesuré n'est pas représentatif, par exemple des lits mesurés avec leur tête ou leur coffre.
3. **Analogie de classe de manutention** : géométrique (ou volume de transport) × rapport médian « relevés / géométrique » des sous-catégories « ancres » de la même classe. Rapports obtenus :

   | Classe | Rapport | Origine |
   | --- | ---: | --- |
   | Appareils et objets rigides | 0,95 | 3 ancres |
   | Meubles démontables | 1,43 | 9 ancres |
   | Sièges rembourrés | 1,47 | 4 ancres |
   | Meubles non démontables | 1,69 | 8 ancres |
   | Autres classes | 1,41 | médiane globale de 26 ancres |

   Ces rapports viennent de **données de déménageurs** : ce n'est pas un coefficient choisi a priori. Mais ils sont appliqués à des objets sans relevé, donc **provisoires**.
4. **Un seul relevé** : moyenne du relevé et de la proposition (2 ou 3).
5. **Exception** : `DIV-AUTRE`. Le volume vient d'une sous-catégorie comparable choisie au cas par cas (règle `volume_source = comparable` du parcours), sinon il est fixé par le déménageur.

Les **204 variantes de taille** reçoivent le volume de leur sous-catégorie parente, en proportion de leur volume géométrique : toutes provisoires.

**Ce qui n'est jamais fait** :
- appliquer un coefficient unique à tout le catalogue ;
- présenter un relevé de déménageur comme une mesure ;
- marquer « vérifié » une valeur qu'aucun déménageur pilote n'a validée.

---

## 4. Relevés de déménageurs : portée et limites

- **132 relevés** sur **71 sous-catégories**, issus de **23 sources** : 15 sites nommés (simulateurdemenagement.fr, demenagements-picard.fr, demenhouse.fr, devisdemenagement.com, formadem.com, un-calcul.fr…) et 8 « synthèses de recherche » regroupant plusieurs sites (détail dans `releves_demenageurs.csv`).
- **Mode de collecte** : moteur de recherche seulement. Le réseau de la session bloque ces sites, ainsi que les sites des fabricants et distributeurs (IKEA, Conforama…). **Aucune page n'a été ouverte.** Les valeurs reprises des extraits doivent être relues sur les pages avant validation.
- **Attribution** : 37 relevés sont attribués à un site précis ; les autres sont « non attribués » (comptés comme une source anonyme par synthèse).
- **Fourchettes** (« 0,6 à 1 m³ ») ramenées à leur milieu et signalées.
- **Hétérogénéité.** Ces barèmes ne disent pas toujours si le meuble est monté ou démonté, avec ou sans emballage. La dispersion est forte, par exemple lit double de 0,8 à 2,6 m³ ou canapé 3 places de 1,5 à 3 m³. C'est la limite principale : **ces valeurs sont des conventions commerciales, pas des mesures.**
- **1 relevé aberrant** écarté : micro-ondes à 0,5 m³.

---

## 5. Décisions humaines nécessaires

Liste complète : `anomalies.csv`, 128 lignes, dont 60 de priorité élevée.

1. **Adopter ou non les volumes v6 pour les devis.** Ils dépassent l'ancien catalogue d'environ +50 % sur les inventaires types. 48 sous-catégories s'écartent de plus de 50 % de leur ancienne valeur, dans un sens ou dans l'autre, dont 39 prioritaires. C'est une décision commerciale : à valider avec un ou deux déménageurs pilotes sur 3 à 5 vrais inventaires, avant tout branchement (qui demandera une migration et une modification du moteur, non faites ici).
2. **Convention du carton** :

   | Valeur | Origine |
   | --- | --- |
   | 0,05 m³ | relevé public |
   | 0,06 m³ | carton standard de 50 × 40 × 30 cm |
   | 0,075 m³ | médiane v6 |
   | 0,1 m³ | relevé public et ancien catalogue |

   Elle pèse directement sur le volume déclaré par le client.
3. **Lits** : les grands lits mesurés (queen, king, coffre, « taille non précisée ») ont des géométriques de 2,9 à 4,4 m³, contre 1,0 m³ pour le lit double. Le périmètre des produits est incohérent (tête de lit, ensembles). La v6 contourne le problème par des comparables. Il faut revoir les produits.
4. **Armoires 4 portes et 5 portes** : les relevés donnent 4,0 m³ (de 2,0 à 4,3), d'où 6,9 m³ proposés pour 5 portes et plus. À trancher avec un déménageur : armoire montée ou démontée ?
5. **Bibliothèques, buffets, vitrines** : les relevés publics valent 2,5 à 3,2 fois le volume géométrique médian (5 cas). Les barèmes visent peut-être de plus grands modèles.
6. **Électroménager** : largeurs mesurées sur le marché nord-américain (ENERGY STAR). Combiné de 74,9 cm de large au lieu des 60 cm courants en France. Il faudra des données EPREL (démarche en attente de votre part) ou des mesures françaises.
7. **Produits mal classés** (distributeur, comptoir, gondole, imprimante, chaise haute) : volumes géométriques invraisemblables, à reclasser.
8. **Sous-catégories à scinder** : abri ou coffre de jardin ; piscine tubulaire ou spa.
9. **Définition d'une « source distincte »** : marque ou base documentaire (§ 3.1).
10. **33 sous-catégories prioritaires mesurées sur 1 ou 2 produits seulement**, dont table 6 personnes, table 4 personnes, réfrigérateur, piano droit et four : compléter par des mesures.

---

## 6. Fichiers livrés (`data/catalogue-v6/`)

| Fichier | Contenu |
| --- | --- |
| `catalogue_volumes_v6.csv` / `.json` | 311 sous-catégories, 30 champs (identifiant, nom, nombre de produits et de sources, géométrique et P25/P75, statut et fiabilité, volume de transport, volume de déménagement et P25/P75, statut, fiabilité, méthode, relevés, valeur héritée, statut d'ensemble, réserves) ; le JSON contient aussi les variantes et les rapports de classe |
| `variantes_v6.csv` | 204 variantes de taille |
| `mesures_individuelles.csv` | 9 958 mesures individuelles (produits retenus et exclus), copiées de la v5 |
| `releves_demenageurs.csv` | 132 relevés publics, avec source, attribution et remarque |
| `estimations_ia.csv` | 90 estimations de l'IA (dimensions, fourchette, justification) |
| `ratios_classes.csv` | rapports par classe et sous-catégories ancres |
| `anomalies.csv` | 128 anomalies, avec décision proposée et priorité |
| `couverture_inventaires.csv` | couverture des 3 inventaires types et des 3 pièces du banc |
| `synthese.json` | indicateurs |

Scripts : `scripts/catalogue_v6/` (`enrichir.py`, `releves_demenageurs.py`, `estimations_ia.py`, `comparables.py`, `inventaires_types.py`, `test_enrichir.py`).

---

## 7. Prochaines étapes proposées (non lancées)

1. **Validation par un déménageur pilote** des volumes de déménagement des 40 sous-catégories les plus fréquentes : une heure de relecture du tableau. Cela ferait passer ces sous-catégories en « vérifié ».
2. **Volume réel chargé** relevé sur quelques déménagements, pour comparer avec les rapports de classe.
3. **Relecture des pages sources** des relevés publics, avec un réseau qui les autorise.
4. **Mesures complémentaires** pour les 33 prioritaires à 1 ou 2 produits et les 52 prioritaires estimées par l'IA : sites des fabricants, ou EPREL pour l'électroménager.
5. **Inventaires pilotes réels** pour refaire la mesure de l'objectif 6.
6. **Après validation seulement** : import en base et branchement sur le moteur (migration et code). Chacune de ces étapes demande votre accord explicite.
