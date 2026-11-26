# Historique du catalogue v6

## v6.2 (version candidate) — 26/11/2026 — non commitée

**Correction finale**
- **Deux sous-catégories créées**, absentes de la v5 et sans doublon. Le catalogue passe à **313 sous-catégories**, dont 228 prioritaires.
  - `CAR-BAC-GRAND` (grand bac de rangement) : 0,20 m³ ;
  - `BAG-VALISE-TRES-GRANDE` (très grande valise) : 0,30 m³.
- **Variantes des valises corrigées** :
  - `BAG-VALISE-C` et `BAG-VALISE-S` passent à 0,20 m³ (valise classique) ;
  - `BAG-VALISE-L` (grand format) est rattachée à `BAG-VALISE-GRANDE` et passe à 0,30 m³.
- **Nouveau fichier `correspondance_identifiants_v6_2.csv`** : anciens identifiants du moteur, variantes et nouvelles sous-catégories.
- **Contrôle de double comptage** : une variante rattachée est signalée si elle est comptée avec sa sous-catégorie.

- **Convention définitive** : meubles comptés montés et complets ; ni calage, ni protection, ni vide de chargement.
- **Démén'House** : quand sa liste sort de la fourchette de son article récent, la borne publiée la plus proche est retenue (commode, chevet, lit double).
- **Plancher géométrique de 80 % retiré.** Seules les valeurs manifestement aberrantes sont écartées (moins de 0,25 fois ou plus de 6 fois le géométrique mesuré).
- **Ratio de classe** calculé sur toutes les valeurs professionnelles retenues (v6.1 : Démén'House seul).
- **Cartons et objets voisins** : champ `inclus_dans_cartons`.
- **Conventions validées (dernière correction)** :
  - bac de rangement : 0,10 m³ ;
  - valise classique : 0,20 m³ ;
  - grande valise : 0,30 m³.

  Ces objets ne sont pas assimilés aux cartons. 
- **Variantes** bornées entre 0,6 et 1,6 fois leur parente.
- **Contrôle automatique des doubles comptages** dans les inventaires ; impact commercial des anomalies ; nouvel état « choix documenté ».
- **Nouveaux fichiers** :
  - `corrections_v6_2.csv`
  - `anomalies_restantes.csv`
  - `verification_inventaires.csv`
  - `resultats_tests_v6_2.txt`
  - `rapport_final_v6_2.md`
  - `historique/v6.1/` (données et scripts)
- **Revue des 40** au format simplifié (volume proposé, question, volume corrigé, commentaire).
- **Tests** : 32 tests, tous réussis.

## v6.1 — 26/11/2026 (décisions du porteur du projet)

**Décisions appliquées**
- **Carton standard = 0,10 m³** : convention commerciale validée. Les valeurs publiées (0,05 / 0,1 / 0,2 m³) sont conservées comme références.
- **Priorité à Démén'House.** Sa valeur unique publiée est retenue quand elle existe et correspond à l'objet. Sinon, on prend une autre source professionnelle attribuée, puis une valeur non attribuée, puis une sous-catégorie comparable, puis un ratio géométrique de classe.
- **Une valeur retenue est toujours une valeur réellement publiée.** Il n'y a plus de moyenne ni de médiane entre sources, ni de « milieu de fourchette ».
- **Conventions non mélangées.** Le rapport de chaque source à Démén'House est mesuré (`conventions_sources.csv`). Quand la seule valeur disponible vient d'une source dont la convention est manifestement différente, on passe par une sous-catégorie comparable alignée sur Démén'House (7 cas). La valeur de la source reste en référence.
- **Convention « lit complet »** (cadre, sommier, matelas). Les inventaires types n'ajoutent plus matelas et sommier à côté d'un lit : la v6.0 comptait la literie deux fois.

**Corrections**
- Fourchettes conservées comme fourchettes. Une valeur composée par l'assistant a été retirée (« 0,8 + 1,2 » pour un lit 160).
- Attribution corrigée : « armoire 2 portes, environ 1 m³ » n'est plus attribuée à demenagements-picard.fr, car l'attribution n'était pas certaine.
- Source sans valeur retirée (lesartisansdemenageurs.fr). Il reste **14 domaines attribués**, et non « 15 sites » comme écrit en v6.0.
- 29 valeurs Démén'House ajoutées, issues de deux articles du site. Au total : 43 lignes Démén'House, dont 36 valeurs uniques.
- Synthèses non attribuées comptées pour **une seule source** au total, et non une par synthèse.
- Fiabilité « moyenne » seulement si une autre source **attribuée**, d'un autre domaine, confirme la valeur à ± 35 %.
- Valeurs publiées inférieures à 80 % du volume d'un objet rigide non démontable : écartées (physiquement impossibles).
- Produits mal classés exclus du volume géométrique (distributeurs muraux, micro-ondes classé comptoir, présentoirs de vitrine, rehausseur classé chaise haute). Ils restent conservés dans `mesures_individuelles.csv`.
- Comparables résolus par passes successives. En v6.0, un comparable non encore calculé basculait sur le ratio géométrique (cas des lits king et coffre).
- `mesures_individuelles.csv` complété : statut de mesure, adresses des sources, mesures partielles (3 045 lignes), estimations de l'IA.
- `anomalies.csv` : identifiant, état de résolution et action. Le suivi des anomalies v6.0 est dans `suivi_anomalies_v6_0.csv`.

**Nouveaux fichiers**
- `revue_40_categories.csv` et `revue_40_categories.md`
- `conventions_sources.csv`
- `comparatif_versions.csv`
- `decomposition_ecart_v5.csv`
- `suivi_anomalies_v6_0.csv`
- `historique/v6.0/` : copie des fichiers de la v6.0, pour comparer les versions

**Tests** : 24 contrôles (`scripts/catalogue_v6/test_enrichir.py`), tous réussis.

## v6.0 — 26/11/2026

Première version : 311 sous-catégories, 132 relevés publics, volumes médians entre sources, ratios de classe. Les fichiers sont conservés dans `historique/v6.0/` et dans le commit `9f7bc84` de la branche `claude/trusting-wozniak-28f6ok`.
