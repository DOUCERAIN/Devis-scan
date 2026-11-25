# Évaluation réelle de l'analyse IA

Objectif : comparer Haiku 5.5, Sonnet 5.5 et Opus 5.5 **sur les mêmes images**, avec de vrais appels à l'API, et mesurer coûts, oublis, objets inventés et doublons. Aucune simulation.

## Chaîne complète

1. `images/` : photos réelles d'intérieurs sous licence libre (Wikimedia Commons, voir `images/SOURCES.md`).
2. `make-videos.sh` : une vidéo de 10 s par photo (panoramique lent, 1280×720), comme un client qui filme la pièce. *Limite : une vraie vidéo montre plusieurs angles ; ici, une seule photo.*
3. `prepare-frames.e2e.cjs` : chaque vidéo passe par le **vrai parcours client** (navigateur Chromium : compression, extraction et sélection des images de la phase 3, envoi, stockage). Les images réellement stockées sont copiées dans `frames/` avec `frames/manifest.json`.
4. `reference.json` : inventaire de référence par pièce (objets attendus, équivalences, objets facultatifs). **Annotation provisoire à faire valider par un déménageur.**
5. `bench.ts` : appelle chaque modèle avec le même code que la production (`AnthropicVisionProvider`, mêmes consignes, même catalogue, même post-traitement), puis compare à la référence (`src/lib/ai/evaluate.ts`). Résultats dans `results/<date>.md` et `.json`.

## Commandes

```bash
node --conditions=react-server tests/ai-eval/ping.ts --check           # détecte la clé, sans aucun appel
node --conditions=react-server tests/ai-eval/ping.ts                   # appel de test unique et minimal (≈ 0,0001 $)
bash tests/ai-eval/make-videos.sh
NODE_PATH=$(npm root -g) node tests/ai-eval/prepare-frames.e2e.cjs     # Supabase local + application lancée
node --conditions=react-server tests/ai-eval/bench.ts                  # estimation du coût seulement
node --conditions=react-server tests/ai-eval/bench.ts --confirm        # appels réels (DEVIS_SCAN_ANTHROPIC_API_KEY requise)
```

Options : `--models haiku,sonnet,opus`, `--effort low|medium|high`, `--repeat 2` (stabilité), `--max-usd 5` (plafond, arrêt avant tout appel si l'estimation le dépasse).

## Indicateurs

- **Rappel** : part des objets attendus retrouvés (à la quantité près).
- **Précision** : part des objets comptés qui sont réellement présents.
- **Inventés** / **oubliés** : listes détaillées par pièce.
- **Doublons signalés** : doublons possibles marqués, dont ceux qui étaient justifiés.
- **Écart de volume** : volume compté − volume de référence (catalogue).
- **Coût** : calculé à partir des jetons réellement facturés renvoyés par l'API.

Ces mesures portent sur un petit échantillon (photos, pas de vraies vidéos) : elles servent à **choisir un modèle et repérer les défauts**, pas à publier un taux de précision.

## Reprise dans une nouvelle session

Les variables de l'environnement cloud ne sont lues qu'au démarrage d'une session. Dans une nouvelle session sur l'environnement « devis-scan » :
1. `ping.ts` (un seul appel minimal) pour confirmer la clé ;
2. démarrer Docker, Supabase et l'application, régénérer `videos/` et `frames/` (non versionnés) ;
3. `bench.ts` sans `--confirm` (estimation), puis avec `--confirm` après accord du porteur du projet.
