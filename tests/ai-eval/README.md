# Évaluation réelle de l'analyse IA

Comparaison de Claude Haiku 5.5, Sonnet 5.5 et Opus 5.5 **sur les mêmes images**, avec de vrais appels à l'API : reconnaissance des meubles, catégories, volumes, meubles cachés, doublons, coût et temps de réponse. Aucune simulation.

- **Protocole complet** (méthode, notation, budget) : [`PROTOCOLE.md`](PROTOCOLE.md)
- **Jeu de données** (format, images manquantes, comment filmer) : [`dataset/README.md`](dataset/README.md)

## Fichiers

| Fichier | Rôle |
| --- | --- |
| `bench.ts` | Banc de comparaison. Sans `--confirm`, contrôle seulement le jeu de données et le budget (aucun appel). |
| `ping.ts` | Appel de test unique et minimal (clé et réseau). |
| `preflight-photos.ts` | Vérification **hors ligne** de l'analyse par photos (requête préparée pour Haiku 5.5, lots, lecture de la réponse, volumes du catalogue, coût estimé) : aucune requête ne quitte la machine. Voir `docs/test-analyse-reelle-preview.md`. |
| `dataset/<cas>/` | Une pièce : `case.json` (inventaire de référence) et `frames/` (images envoyées aux modèles). |
| `images/`, `make-videos.sh`, `videos/` | Photos réelles sous licence libre, et vidéos panoramiques créées à partir de ces photos. |
| `prepare-frames.e2e.cjs` | Fait passer chaque vidéo par le **vrai parcours client** (navigateur, compression, extraction des images) et remplit `dataset/<cas>/frames/`. |
| `results/` | Créé au premier passage réel : `ledger.json` (registre des dépenses de la campagne, à committer) et `<passage>/` (rapport, CSV, réponses brutes). |
| `src/lib/ai/benchmark/` | Modules testés : modèles, estimation des jetons, budget, jeu de données, notation, rapport. |

## Commandes

```bash
node --conditions=react-server tests/ai-eval/ping.ts --check     # présence de la clé, sans appel
node --conditions=react-server tests/ai-eval/preflight-photos.ts 30  # analyse par photos simulée hors ligne + coût estimé, sans appel
node --conditions=react-server tests/ai-eval/bench.ts            # contrôle du jeu de données + coût maximal, SANS appel
node --conditions=react-server tests/ai-eval/bench.ts --confirm  # appels réels, uniquement après accord explicite
node --conditions=react-server tests/ai-eval/bench.ts --rescore tests/ai-eval/results/<passage>/resultats.json   # renotation sans appel
```

Options : `--models haiku,sonnet,opus` · `--cases id1,id2` · `--effort low|medium|high` (défaut medium) · `--max-output-tokens 7000` · `--repeat 1` · `--max-usd-per-model 0.75` · `--max-usd-campaign 5` (jamais plus de 5) · `--rooms-per-request 6` (projection du coût par demande).

Préparer des images depuis des vidéos : Supabase local et application lancée **sans** `AI_PROVIDER`, puis :

```bash
NODE_PATH=$(npm root -g) node tests/ai-eval/prepare-frames.e2e.cjs
```

## Reprise dans une nouvelle session

Les variables de l'environnement cloud ne sont lues qu'au démarrage d'une session. Sur l'environnement « devis-scan », la clé est disponible dans `DEVIS_SCAN_ANTHROPIC_API_KEY`. Le registre `results/ledger.json`, versionné, conserve les dépenses déjà faites : le plafond de 5 $ porte donc sur toute la campagne, même d'une session à l'autre.
