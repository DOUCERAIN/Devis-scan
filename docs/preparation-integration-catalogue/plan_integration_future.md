# Plan d'intégration future du catalogue v5 au moteur IA

Rien de ce plan n'est réalisé. Chaque étape est **réversible** et testable seule. Le moteur V1 reste en service jusqu'à la bascule (étape 7).

## Étape 0 — Décisions à prendre (vous)

Voir `PROGRESSION.md`, § « Décisions » : volume utilisé par le devis, démarche EPREL, import du catalogue, accord pour le benchmark réel, validation des niveaux de pertinence.

## Étapes de développement

| # | Étape | Contenu | Dépend de | Vérification |
| --- | --- | --- | --- | --- |
| 1 | Catalogue en base | migration **non destructive** : tables `catalog_references` et `catalog_aliases` (alias historiques, remplacements), alimentées depuis `data/catalogue-v5/catalogue_devis_scan.json` ; `furniture_catalog` conservée ; lecture publique comme aujourd'hui | décision 3 | tests pgTAP (contenu, droits, aucun identifiant réutilisé) |
| 2 | Module serveur du catalogue | `src/lib/catalog/` : chargement, `rechercherCandidates`, `resoudreObjet`, volumes (portage du prototype, mêmes tests) | 1 | `npm test` (34 tests portés) |
| 3 | Contrat 2.0 | lecture du contrat, enveloppe, compatibilité V1 ; colonnes `contract_version`, `prompt_version`, `catalog_version`, `catalog_hash` dans `analysis_runs` ; activable par variable (`AI_CONTRACT=2`), V1 par défaut | 2 | tests unitaires et relecture des `raw_output` V1 existants |
| 4 | Consignes v2 | catalogue compact (≈ 4 400 jetons) dans les consignes, simulateur mis à jour au format 2.0 | 3 | parcours e2e en simulation (`test:e2e:client`) |
| 5 | Benchmark réel | 15 cas du protocole et logements réels ; Haiku, Sonnet, plus tard un modèle open source | 4 + **votre accord** (budget 0,75 $ par modèle, 5 $ au total) | `tests/ai-eval/` : notation des références, des « inconnue » et des identifiants refusés |
| 6 | Espace professionnel | statut de la référence (trouvée, à confirmer, inconnue), alternatives cliquables, indices, volume géométrique et volume de déménagement affichés séparément | 3 | e2e `test:e2e:verification` |
| 7 | Bascule progressive | contrat 2.0 activé d'abord pour une entreprise de démonstration ou un pilote, puis pour tous ; V1 relue, jamais supprimée | 5, 6 | comparaison V1 / V2 sur les mêmes demandes (`comparer`) |
| 8 | EPREL | après la clé et votre validation des conditions : téléchargement, catalogue v6, rafraîchissement mensuel | **votre démarche** | `test_eprel.py` puis audit des dimensions |
| 9 | Fournisseur open source et secours | adaptateur supplémentaire (même contrat), ordre de secours configurable | 3 | tests de secours et de comparaison |
| 10 | Volume de déménagement validé | conventions par sous-catégorie établies avec les déménageurs pilotes (relevés terrain), champ `facteur_conversion_demenagement` renseigné avec sa source | décision 1 + pilotes | revue par un professionnel |

## Points de compatibilité à préserver

- Les demandes et devis existants gardent leur `catalog_key` (ancien catalogue) : jamais réécrit. La nouvelle référence est ajoutée à côté.
- Le moteur de volume (`src/lib/inventory/volume.ts`) et le moteur de devis (`src/lib/pricing/engine.ts`) ne changent pas d'interface : ils reçoivent toujours un volume unitaire et une source de volume. Seule l'origine de ce volume change, et elle est tracée.
- Le parcours client n'est pas modifié avant l'étape 6 (affichage), et seulement si vous le validez.

## Risques techniques

| Risque | Effet | Parade prévue |
| --- | --- | --- |
| Sous-catégories à dimensions partielles (réfrigérateurs, lave-vaisselle) | aucun volume géométrique pour des objets très courants | volume de déménagement hérité s'il existe, sinon saisie ; EPREL (étape 8) |
| Volumes hérités douteux (`ELM-REF-COMBI` 0,4 m³ ; `ARM-4P` 1,2 m³ contre 2,17 m³ géométrique) | sous-estimation du devis | décision 1 ; revue par les déménageurs pilotes |
| Fiabilité faible (1 à 4 modèles) sur des sous-catégories courantes (`ARM-1P`, `ARM-4P`, `TAB-6`) | volume provisoire présenté comme sûr | avertissement transmis par la résolution ; jamais « sûr » sans validation |
| Caractéristiques « vues » mais inventées par le modèle | mauvaise sous-catégorie | indices obligatoires ; contrôle de cohérence ; confirmation sous 0,6 ; benchmark |
| Variantes de taille fondées sur des tiers de modèles observés | taille « grande » sans sens commercial | variantes seulement sur dimensions apparentes, affichées comme indication |
| Croissance du catalogue (références commerciales individuelles) | consignes trop longues | niveau 2 de la recherche (candidates par famille) déjà prêt |
| Modèles open source moins fiables en JSON | réponses rejetées | revalidation commune, secours, deux passages |
| Obligation EPREL de mise à jour | copies obsolètes | rafraîchissement planifié et traçable ; suppression possible par source |
| Prototype non optimisé (index reconstruit à chaque appel) | lenteur à grande échelle | à corriger au portage (étape 2) |
