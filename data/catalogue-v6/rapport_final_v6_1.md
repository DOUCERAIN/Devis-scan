# Catalogue v6.1 — rapport final

**Date** : 26/11/2026. **Périmètre** : uniquement `data/catalogue-v6/` et `scripts/catalogue_v6/`.

**Ce qui n'a pas été modifié** : le catalogue v5, Supabase, les migrations, le moteur de devis, le parcours client, les appels à l'IA, la production et la préproduction. Aucune nouvelle valeur n'est intégrée aux devis. Aucun achat, abonnement ou service payant.

**Aucune valeur n'a été validée par un professionnel du déménagement.** Seule la convention du carton (0,10 m³) est validée, par le porteur du projet.

---

## 1. État des fichiers demandés

Les trois fichiers existaient déjà. Ils ont été générés le 26/11/2026 et enregistrés dans le commit `9f7bc84`, sur la branche de travail `claude/trusting-wozniak-28f6ok` et non sur `main`, ce qui explique sans doute que vous ne les ayez pas trouvés.

Ils ont été vérifiés, puis **régénérés et complétés** en v6.1, dans `data/catalogue-v6/`. La version précédente est conservée dans `historique/v6.0/`.

| Fichier | Lignes | Contenu v6.1 | Contrôle |
| --- | ---: | --- | --- |
| `catalogue_volumes_v6.csv` | 311 | identifiant, nom, volume v5, volume v6.0, **volume retenu**, type de référence, règle, source principale, autres références, nombre de sources indépendantes, divergence, fiabilité, statut de validation, méthode, volume géométrique (P25, P75, dispersion, statut, fiabilité, nombre de produits et de sources), volume de transport, réserves | test : chaque volume du fichier = donnée calculée |
| `anomalies.csv` | 321 | identifiant, sous-catégorie(s), type, description, priorité, **état de résolution**, action v6.1, décision proposée, origine | test : état et identifiant présents partout |
| `mesures_individuelles.csv` | 13 096 | sous-catégorie, produit, **statut de mesure**, source distincte, bases, nom, marque, dimensions, volume calculé, adresses des sources, remarque | test : tous les produits de la v5 sont présents |

**Statuts dans `mesures_individuelles.csv`**

| Statut | Lignes |
| --- | ---: |
| Mesuré et retenu | 9 714 |
| Exclu comme valeur aberrante (v5) | 230 |
| Exclu comme produit mal classé (v6.1) | 14 |
| Mesure partielle (2 dimensions sur 3) | 3 045 |
| Estimation de l'IA (modèle type ou état de transport) | 93 |

**Données manquantes, laissées vides** :
- volume des mesures partielles (une dimension manque) ;
- adresse source de certains produits muséaux ;
- dimensions individuelles de l'électroménager partiellement mesuré : seules les médianes v5 sont connues pour la dimension estimée.

---

## 2. Modifications effectuées

1. **Carton** : 0,10 m³, statut « convention commerciale validée par Devis Scan (pas une mesure) ». Les autres valeurs restent en références :
   - 0,05 m³ ;
   - 0,1 m³ ;
   - 0,2 m³ pour le carton « medium » de Démén'House, qui écrit aussi « 1 m³ tous les cinq cartons ».

   Aucune variante n'hérite de cette valeur. Le parcours client n'est pas modifié.
2. **Démén'House prioritaire.** 36 valeurs uniques relevées sur deux articles du site :
   - la **liste à valeur unique** sert de référence (règle 1) ;
   - l'**article récent à fourchettes** sert de référence secondaire.

   Retenues : **28 sous-catégories**. Écartée : le meuble TV, publié à 3,2 m³ alors que le meuble mesure 0,32 m³ en médiane (10 fois plus). Règle de correspondance appliquée : une valeur plus de 6 fois supérieure au géométrique médian mesuré ne correspond pas à l'objet courant.
3. **Valeurs publiées uniquement**, sans moyenne ni médiane entre sources (contrôlé par test). Les fourchettes ne sont plus réduites à leur milieu.
4. **Conventions** : voir § 4.
5. **Convention « lit complet »** et correction des inventaires types : la literie n'est plus comptée deux fois.
6. **Produits mal classés exclus** (4 sous-catégories, 14 produits), conservés dans les mesures.
7. **Comptage des sources corrigé** : les synthèses de recherche anonymes comptent pour une seule source.
8. **Valeurs physiquement impossibles écartées** : moins de 80 % du volume d'un objet rigide non démontable. Exemple : réfrigérateur américain à 0,8 m³ pour un appareil de 1,16 m³.

**Volumes modifiés** : 304 sous-catégories changent entre v6.0 et v6.1, dont 219 prioritaires (anciennes et nouvelles valeurs dans `comparatif_versions.csv`). Principales sous-catégories :

| ID | v5 | v6.0 | **v6.1** | Origine v6.1 |
| --- | ---: | ---: | ---: | --- |
| `CAR-CARTON` | 0,1 | 0,075 | **0,10** | convention validée |
| `ARM-2P` | 0,8 | 1,225 | **1,25** | simulateurdemenagement.fr |
| `ARM-3P` | — | 1,8 | **1,8** | simulateurdemenagement.fr |
| `ARM-4P` | 1,2 | 4,0 | **4,3** | Démén'House |
| `ARM-NC` | — | 1,65 | **2,3** | Démén'House (armoire « standard ») |
| `CAN-2P` | 1,0 | 1,49 | **2,5** | Démén'House |
| `CAN-3P` | 1,5 | 1,65 | **3,0** | Démén'House |
| `CAN-ANG` | 1,62 | 3,13 | **4,21** | comparable du canapé 3 places (alignement Démén'House) |
| `CAN-CONV` | 1,29 | 2,1 | **2,52** | comparable du canapé 3 places (alignement Démén'House) |
| `LIT-SIMPLE` | 0,8 | 0,9 | **1,3** | Démén'House |
| `LIT-DOUBLE` | 1,2 | 1,5 | **2,6** | Démén'House |
| `LIT-QUEEN` | 1,4 | 1,45 | **2,99** | lit double × 1,15 (alignement Démén'House) |
| `LIT-KING` | 2,07 | 1,67 | **3,44** | lit 160 × 1,15 |
| `LIT-SUPERP` | — | 1,7 | **1,6** | un-calcul.fr |
| `MAT-140` | 0,5 | 0,63 | **0,7** | comparable du matelas 160 |
| `COM-NC` | 0,5 | 0,45 | **1,5** | Démén'House (incohérent avec son autre article : 0,5 à 1 m³) |
| `CHV-STD` | 0,1 | 0,225 | **0,3** | Démén'House (autre article : 0,15 à 0,25 m³) |
| `BUR-DROIT` | 0,6 | 0,8 | **1,4** | Démén'House |
| `TAB-BASSE` | 0,3 | 0,475 | **1,0** | Démén'House |
| `TAB-REPAS-NC` | — | 1,11 | **1,5** | Démén'House |
| `TAB-6` | 0,8 | 1,2 | **1,62** | comparable de la table à manger (alignement Démén'House) |
| `CHA-REPAS` | 0,15 | 0,2 | **0,25** | Démén'House |
| `FAU-STD` | 0,5 | 0,7 | **0,7** | Démén'House |
| `RAN-BUFFET` | 0,56 | 1,43 | **1,2** | Démén'House |
| `RAN-BIB-NC` | 0,6 | 1,2 | **2,0** | Démén'House |
| `RAN-MEUBLE-TV` | 0,42 | 0,55 | **0,4** | non attribuée (Démén'House écarté) |
| `ELM-REF` | 0,4 | 0,93 | **1,0** | Démén'House |
| `ELM-REF-COMBI` | 0,4 | 1,17 | **1,5** | non attribuée |
| `ELM-REF-US` | — | 1,65 | **1,8** | non attribuée (0,8 écarté : sous le volume de l'appareil) |
| `ELM-CONG` | 0,4 | 1,05 | **1,6** | Démén'House |
| `ELM-LL` | 0,3 | 0,5 | **0,5** | non attribuée (Démén'House : fourchette 0,6 à 0,8) |
| `ELM-LV` | 0,3 | 0,45 | **0,6** | Démén'House |
| `MUS-PIANO-DROIT` | 2,5 | 1,5 | **2,0** | Démén'House |
| `VEL-ADULTE` | 0,5 | 0,58 | **0,8** | Démén'House |
| `JAR-TABLE` | 0,33 | 1,32 | **2,3** | Démén'House |

---

## 3. Origine des volumes retenus

| Origine | Toutes (311) | Prioritaires (226) |
| --- | ---: | ---: |
| Valeur unique Démén'House | 28 | 27 |
| Autre source professionnelle **attribuée** à un site | 8 | 8 |
| Valeur professionnelle **non attribuée** (synthèse de recherche) | 28 | 26 |
| Estimation par **analogie** (sous-catégorie comparable) | 36 | 35 |
| Estimation par **ratio géométrique** de classe | 209 | 128 |
| Convention validée (carton) | 1 | 1 |
| Exception documentée (objet non classé) | 1 | 1 |
| **Valeurs vérifiées par un professionnel** | **0** | **0** |

**Fiabilité du volume de déménagement**

| Fiabilité | Nombre | Critère |
| --- | ---: | --- |
| Élevée | 1 | la convention du carton |
| Moyenne | 5 | valeur confirmée à ± 35 % par une autre source attribuée d'un autre domaine |
| Provisoire | 304 | les autres |

Seules **61 prioritaires sur 226 (27 %)** ont une valeur professionnelle propre. En comptant les mesures géométriques, **187 sur 226 (83 %)** ont au moins une référence documentée. Les 128 prioritaires estimées par ratio géométrique sont les moins sûres : elles héritent de la convention Démén'House (rapports de 1,9 à 2,7 pour les meubles).

---

## 4. Audit des références

| Type | Lignes | Remarque |
| --- | ---: | --- |
| Attribuées à Démén'House | 43 | 36 valeurs uniques, 7 fourchettes ; deux articles du même site, comptés comme **une** source |
| Attribuées à 13 autres domaines | 28 | 14 domaines attribués au total (§ 4.2) |
| Non attribuées | 90 | 8 synthèses de recherche, comptées comme **une seule** source au total |
| **Total** | **161** | 135 valeurs uniques, 26 fourchettes ; 75 sous-catégories |

**4.1 Nature des sources.** Elle est déduite du nom du site et non vérifiée :
- entreprises de déménagement : Démén'House, demenagements-picard.fr, mtn-demenagement.com, formadem.com ;
- comparateurs et plateformes : devisdemenagement.com, demenageur.com, ouimove.com, deliverhome.fr ;
- sites de calcul généralistes : macalculatriceenligne.com, un-calcul.fr, simulateurdemenagement.fr ;
- loueur de véhicules : utililoc.com ;
- garde-meubles : lockall.fr ;
- média : femmexpat.com.

Les URL sont conservées dans `releves_demenageurs.csv`.

**4.2 Les 14 domaines et les 15 sites.** Le rapport v6.0 annonçait 15 sites. Il comptait lesartisansdemenageurs.fr, qui ne donnait qu'une fourchette générale de pianos, inutilisée. Ce site est retiré. **Il y a 14 domaines attribués**, ce que contrôle un test.

**4.3 Conventions différentes** (`conventions_sources.csv`). Sur 24 sous-catégories communes, **Démén'House publie des volumes environ 1,6 fois plus élevés que les autres sources**.

| Source | Rapport médian à Démén'House | Sous-catégories communes |
| --- | ---: | ---: |
| formadem.com | 0,39 | 4 |
| macalculatriceenligne.com | 0,50 | 5 |
| Synthèses non attribuées | 0,61 | 24 |

Les autres sources n'ont qu'une sous-catégorie commune : convention indéterminée.

Démén'House n'est pas cohérent avec lui-même. Sa liste est souvent au plafond, ou au-dessus, des fourchettes de son article récent :
- commode : 1,5 m³ dans la liste, 0,5 à 1 m³ dans l'article ;
- chevet : 0,3 m³ dans la liste, 0,15 à 0,25 m³ dans l'article ;
- lit double : 2,6 m³ dans la liste, 1,5 à 2,5 m³ dans l'article.

**4.4 Limite de collecte.** Toutes les valeurs viennent d'extraits du moteur de recherche. Le réseau de la session bloque ces sites, donc **aucune page n'a été ouverte**. Chaque valeur est à relire à la source avant validation.

---

## 5. Vérification de la hausse entre v5 et v6

**Inventaires types** (construits par l'IA, non réels ; cartons exclus) :

| Logement type | v5 (objets communs) | v6.0 | **v6.1** | Total v6.1 | Scénario sans Démén'House |
| --- | ---: | ---: | ---: | ---: | ---: |
| Studio / T1 | 7,7 m³ | 11,8 m³ | **15,7 m³ (+103 %)** | 16,0 m³ | 11,4 m³ |
| T3 familial | 13,8 m³ | 20,7 m³ | **29,7 m³ (+115 %)** | 34,2 m³ | 26,7 m³ |
| Maison 5 pièces | 32,7 m³ | 49,9 m³ | **70,3 m³ (+115 %)** | 84,8 m³ | 71,9 m³ |

**Décomposition de la hausse v5 → v6.1** (`decomposition_ecart_v5.csv`) :

| Cause | T3 | Maison |
| --- | ---: | ---: |
| v5 inférieure au volume du meuble (erreur de la v5) | +5,1 m³ | +15,6 m³ |
| Valeurs Démén'House | +7,4 m³ | +12,6 m³ |
| Autres valeurs professionnelles | +2,6 m³ | +4,5 m³ |
| Ratios géométriques et comparables | +0,8 m³ | +4,9 m³ |

**Conclusions**
- **La v5 est trop basse, c'est établi.** 19 valeurs sont inférieures au volume physique de l'objet : lave-linge 0,3 m³ pour 0,53 m³, réfrigérateur 0,4 m³ pour 0,90 m³.
- **Une large part de la hausse v6.1 vient du choix de Démén'House**, dont la convention est environ 1,6 fois plus généreuse. Le scénario sans Démén'House donne environ 22 % de volume en moins pour un T3.
- **Contrôle de vraisemblance** avec la règle « surface ÷ 2 », que Démén'House juge lui-même approximative, et environ 0,10 m³ par carton :

  | Logement | Surface | Règle « surface ÷ 2 » | v6.1 avec les cartons |
  | --- | ---: | ---: | --- |
  | T3 | 65 m² | environ 33 m³ | environ 38 m³ (40 cartons) : plausible, peut-être un peu haut |
  | Maison | 120 m² | environ 60 m³ | environ 93 m³ : probablement surestimé, à cause des ratios géométriques à la convention Démén'House appliqués aux objets de garage et de jardin |

**Ne considérez pas la v6.1 comme meilleure par principe.** Elle applique vos règles et rend les écarts visibles, mais le bon niveau se situe probablement entre le scénario sans Démén'House et la v6.1. Seul un professionnel peut trancher, idéalement avec quelques volumes réellement chargés.

---

## 6. Anomalies

**État des 321 anomalies v6.1**

| État | Nombre |
| --- | ---: |
| Ouvertes | 271, dont 91 de priorité élevée |
| Contournées provisoirement | 13 |
| Résolues | 37 |

**Suivi des 128 anomalies de la v6.0** (`suivi_anomalies_v6_0.csv`)

| Suivi | Nombre |
| --- | ---: |
| Résolues | 23 |
| Remplacées par les nouveaux contrôles | 56 |
| Toujours ouvertes | 48 |
| Contournée | 1 |

**Résolues**
- convention du carton ;
- produits mal classés ;
- meuble TV de Démén'House écarté ;
- 19 valeurs v5 inférieures au volume du meuble, remplacées ;
- valeurs publiées physiquement impossibles écartées.

**Contournées provisoirement**
- convention « lit complet » ;
- géométriques incohérents des grands lits (comparables à la place) ;
- 11 objets mesurés déployés (volume de transport estimé).

**Ouvertes principales**
1. Armoires montées ou démontées.
2. Démén'House incohérent avec lui-même (commode, chevet et 2 autres cas).
3. 27 divergences entre sources supérieures à un rapport de 1,5.
4. Valeurs professionnelles 2,3 à 5,4 fois supérieures au volume du meuble (bibliothèque, buffet, table basse, commode).
5. Électroménager mesuré sur le marché nord-américain.
6. 128 prioritaires sans aucune référence professionnelle.
7. 32 prioritaires mesurées sur 1 ou 2 produits.
8. 204 variantes héritées de leur parente : ne pas les exposer aux devis avant validation.
9. Abri de jardin et piscine à scinder.
10. 90 valeurs non attribuées, à relire à la source.

---

## 7. Catégories à valider sur le terrain

Voir `revue_40_categories.md` et `revue_40_categories.csv` : 40 sous-catégories, avec une question précise pour chacune et deux colonnes vides à remplir pendant l'échange.

La sélection tient compte de la fréquence, du poids dans le volume, des anomalies ouvertes, des divergences et de la fiabilité. Les cinq premières sont le lit double, le bureau droit, la table basse, la commode et la bibliothèque.

Il faut d'abord poser **quatre questions générales**. Elles règlent la majorité des cas :
- les volumes comptent-ils les meubles **démontés** ou montés ?
- comptent-ils la **protection** et le calage ?
- un **lit** compte-t-il le cadre, le sommier et le matelas ensemble ?
- quelle convention est la plus proche de la vôtre : **celle de Démén'House, ou celle des autres sites** (environ 1,6 fois plus basse) ?

---

## 8. Limites des données

- **Aucune validation terrain.** Les valeurs Démén'House sont des estimations indicatives tirées de l'expérience, et non des mesures Devis Scan.
- **Collecte indirecte.** Les valeurs viennent d'extraits de recherche, et plus de la moitié des lignes (90 sur 161) ne sont pas attribuées.
- **Conventions hétérogènes.** Elles sont mesurées sur peu de sous-catégories communes (4 à 24).
- **Peu de valeurs professionnelles propres.** 209 sous-catégories sont estimées par ratio ou par comparable.
- **Inventaires types construits** : aucun inventaire pilote réel.
- **Géométriques limités.** Électroménager mesuré sur le marché nord-américain, 78 sous-catégories estimées par l'IA.

---

## 9. Tests exécutés

```bash
python3 scripts/catalogue_v6/enrichir.py
```

```bash
python3 scripts/catalogue_v6/revue.py
```

```bash
python3 -m unittest scripts/catalogue_v6/test_enrichir.py
```

**Résultat : 24 tests, tous réussis.** Ils contrôlent :
- les 311 identifiants stables ;
- un volume ou une exception partout ;
- le carton à 0,10 m³ dans le CSV et le JSON ;
- Démén'House retenu ou son rejet motivé ;
- le meuble TV écarté ;
- une valeur retenue toujours publiée, et les fourchettes jamais réduites à leur milieu ;
- la convention « lit complet » et les inventaires corrigés ;
- aucune valeur présentée comme validée par un professionnel ;
- la fiabilité « moyenne » seulement si elle est corroborée ;
- les sources anonymes comptées pour une ;
- les 14 domaines ;
- les estimations jamais présentées comme des mesures ;
- le géométrique v5 inchangé hors exclusions ;
- les produits mal classés exclus mais conservés, et toutes les mesures v5 conservées ;
- aucun objet rigide sous son propre volume ;
- les ordres incohérents signalés ;
- un état de résolution pour chaque anomalie ;
- les exports cohérents avec les données ;
- les variantes marquées comme héritées ;
- 40 lignes de revue ;
- la v5 non modifiée.

Aucun autre test du projet n'a été lancé : aucun fichier hors du catalogue v6 n'est modifié.

---

## 10. Fichiers (`data/catalogue-v6/`)

| Fichier | Contenu |
| --- | --- |
| `catalogue_volumes_v6.csv` / `.json` | catalogue v6.1 (le JSON ajoute les références détaillées, les estimations, les règles et les variantes) |
| `variantes_v6.csv` | 204 variantes, marquées « héritées » |
| `mesures_individuelles.csv` | 13 096 lignes |
| `anomalies.csv`, `suivi_anomalies_v6_0.csv` | anomalies v6.1 et suivi des anomalies v6.0 |
| `revue_40_categories.csv` / `.md` | document de revue avec un professionnel |
| `releves_demenageurs.csv` | 161 références, avec URL, attribution, convention et indication de la valeur retenue |
| `conventions_sources.csv` | rapport de chaque source à Démén'House |
| `comparatif_versions.csv` | v5, v6.0, v6.1 et scénario sans Démén'House pour chaque sous-catégorie |
| `decomposition_ecart_v5.csv` | causes de la hausse par inventaire type |
| `couverture_inventaires.csv`, `ratios_classes.csv`, `estimations_ia.csv`, `synthese.json` | indicateurs |
| `CHANGELOG.md`, `historique/v6.0/` | historique et données de la version précédente |
