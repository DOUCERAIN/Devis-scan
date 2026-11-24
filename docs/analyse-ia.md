# Analyse IA des vidéos (phase 4)

## Ce qui est fait

1. À l'envoi de la demande, le serveur lance l'analyse (`src/lib/analysis/run.ts`, exécutée après la réponse grâce à `after()` de Next.js ; reprise quotidienne par `/api/taches/analyses` si elle n'a pas démarré).
2. Pour chaque pièce : jusqu'à **8 images** extraites des vidéos (réparties dans le temps) sont envoyées au fournisseur, **depuis le serveur uniquement**. Les vidéos elles-mêmes ne sont jamais envoyées.
3. Le modèle répond dans un **format JSON imposé** (sortie structurée) : objets, quantité, identifiant du catalogue, score, visibilité, images où l'objet apparaît, doublon possible. La réponse est revalidée (zod) ; une réponse invalide est rejetée, rien n'est complété au hasard.
4. Post-traitement déterministe (`src/lib/ai/postprocess.ts`) :
   - rattachement au catalogue : identifiant proposé, sinon nom ou synonyme **exact** ; sinon « hors catalogue » ;
   - volume : volume de déménagement du catalogue ; à défaut, dimensions estimées × coefficient de manutention (jamais « sûr ») ; à défaut, **0 et « volume à renseigner »** ;
   - objet peu visible → « incertain » ; volume issu de dimensions → « à vérifier » au mieux ;
   - **dédoublonnage** : même référence vue sur une image commune dans une pièce, objet rarement en double (réfrigérateur, lave-linge, piano…) vu dans deux pièces, ou doublon signalé par le modèle → « doublon possible » (violet, non compté, décision humaine). Rien n'est supprimé automatiquement.
5. Inventaire enregistré (`inventory_items`, avec la proposition d'origine de l'IA dans `ai_proposal`, jamais modifiée) et liens vers les images (`inventory_item_frames`).
6. Estimation calculée avec la grille de l'entreprise (voir `docs/devis.md`).
7. Progression réelle enregistrée (`analysis_runs.stage`, pièces traitées) et affichée au client.

Les scores de confiance sont ceux du modèle, plafonnés par les règles ci-dessus. **Ce ne sont pas des probabilités garanties** ; les seuils (85 % / 60 %) restent à recalibrer après des tests réels.

## Fournisseur retenu et configuration

| Variable (serveur, jamais `NEXT_PUBLIC_`) | Rôle |
| --- | --- |
| `AI_PROVIDER` | `anthropic` (vraie analyse) ; `simulation` (tests uniquement) ; vide = pas d'analyse automatique |
| `ANTHROPIC_API_KEY` | Clé API Anthropic (Vercel : variable d'environnement chiffrée) |
| `AI_MODEL` | Défaut `claude-opus-5-5` ; possible : `claude-sonnet-5-5`, `claude-haiku-5-5` |
| `AI_EFFORT` | `low`, `medium` (défaut), `high` |
| `AI_ALLOW_SIMULATION` | `1` pour autoriser le simulateur (refusé si la base n'est pas locale ou sur Vercel) |

Sans `AI_PROVIDER`, aucune dépense : la demande arrive « à vérifier » et le déménageur établit l'inventaire à la main. **Aucun appel payant n'a été effectué pendant le développement** (pas de clé fournie).

Le fournisseur est interchangeable (`src/lib/ai/provider.ts`) : ajouter un autre service revient à écrire une classe `VisionProvider`.

### Simulateur de test
`src/lib/ai/providers/simulation.ts` renvoie un inventaire fixe selon le nom de la pièce. Il sert aux tests automatiques. Ses résultats sont marqués `simulated` en base et un bandeau « Environnement de test » s'affiche chez le client et le déménageur. Il est refusé en dehors d'une base Supabase locale et sur Vercel.

## Coût estimé par demande (non mesuré)

Hypothèses : 6 pièces, 8 images de 1280 × 720 par pièce (≈ 1 200 jetons par image, approximation), ≈ 2 000 jetons de consignes et ≈ 3 000 de catalogue (mis en cache après la première pièce), ≈ 2 000 à 4 000 jetons en sortie par pièce (réflexion comprise).

| Modèle | Prix (USD / million de jetons, entrée / sortie) | Estimation par demande de 6 pièces |
| --- | --- | --- |
| Claude Opus 5.5 | 4 / 20 | ≈ 0,50 à 0,80 $ |
| Claude Sonnet 5.5 | 2 / 10 | ≈ 0,25 à 0,40 $ |
| Claude Haiku 5.5 | 0,10 / 0,50 | ≈ 0,02 à 0,04 $ |

Ce sont des **ordres de grandeur**. Le coût réel de chaque analyse est enregistré (`analysis_runs.input_tokens`, `output_tokens`, `cost_usd`) et affiché sur la fiche de la demande. Tarifs relevés le 24/11/2026 dans la documentation Anthropic, à revérifier.

## Comparaison des solutions

| Solution | Reconnaissance mobilier | Coût | Données personnelles | Licence | Verdict |
| --- | --- | --- | --- | --- | --- |
| **Claude (API Anthropic)** | Multimodal : comprend la pièce, regroupe les vues, explique les doutes, sortie structurée | À l'usage (tableau ci-dessus) | Conditions commerciales : pas d'entraînement sur les contenus clients ; clients de l'EEE sous contrat avec Anthropic Ireland. Lieu de traitement et durée de conservation **à vérifier** avant production (DPA) | Commerciale | **Retenu** |
| OpenAI (GPT-5.x vision) | Comparable a priori | GPT-5.5 ≈ 5 $ / M jetons en entrée (source secondaire, page officielle non lue) | À vérifier | Commerciale | Alternative possible via un nouveau `VisionProvider` |
| Ultralytics YOLO | Détection de classes génériques (COCO : chaise, canapé, lit, réfrigérateur…) | Serveur GPU à héberger | Traitement maîtrisé | **AGPL-3.0** ou licence payante | Écarté (licence) |
| DETR, Grounding DINO | Détection, vocabulaire ouvert pour Grounding DINO | Serveur GPU | Maîtrisé | Apache 2.0 | Possible plus tard en complément (comptage), non retenu : pas de compréhension de la pièce, pas de doublons |
| OWL-ViT / OWLv2 | Vocabulaire ouvert | Serveur GPU | Maîtrisé | Non vérifiée | Non évalué |

Pages officielles d'OpenAI, Google, Mistral, COCO, Roboflow et Hugging Face inaccessibles depuis l'environnement de développement : les informations les concernant proviennent de recherches secondaires et doivent être vérifiées.

## Confidentialité

- Images envoyées depuis le serveur, jamais exposées dans le navigateur ; clé API côté serveur uniquement.
- Consignes au modèle : ignorer personnes, documents et écrans.
- Les images des clients **ne sont pas réutilisées** pour constituer un jeu de données ou entraîner un modèle.
- À faire avant la mise en production : mentionner le sous-traitant (Anthropic) dans la politique de confidentialité et le contrat de sous-traitance, vérifier la localisation du traitement.

## Mesurer la qualité (à faire avec de vrais logements)

Aucun taux de précision n'est publié : il n'a pas été mesuré. Le module `src/lib/ai/evaluate.ts` compare une analyse à un **inventaire de référence annoté** (objets manqués, objets inventés, précision, rappel, écart de volume, doublons correctement signalés). Les scénarios de `src/lib/ai/scenarios.test.ts` utilisent des réponses de modèle **écrites à la main** : ils testent la chaîne de calcul, pas l'IA.

Protocole proposé : 10 à 20 logements réels filmés avec l'accord écrit des occupants, inventaire de référence établi par un déménageur, analyse avec la clé de l'entreprise, comparaison, recalibrage des seuils de confiance.
