# Premier test de l'analyse IA réelle (Preview Vercel, photos)

Objectif : faire analyser par Claude Haiku 5.5 les photos d'un vrai logement, dans la **Preview** de la branche `claude/trusting-wozniak-28f6ok` uniquement. La Production n'est pas modifiée.

## État vérifié le 27/11/2026

- **Intégration existante, inchangée** : `src/lib/ai/` (fournisseur `AnthropicVisionProvider`, client unique `anthropic-client.ts`), orchestration `src/lib/analysis/run.ts`, découpage en lots `src/lib/analysis/batches.ts`.
- **Modèle** : `claude-haiku-5-5`, effort `medium`. La réflexion adaptative est active par défaut sur ce modèle et comptée dans la sortie.
- **Clé** : variable `DEVIS_SCAN_ANTHROPIC_API_KEY`, jamais `ANTHROPIC_API_KEY`. La version du SDK installée (1.7.0) la transmet en `Authorization: Bearer`, uniquement vers `https://api.anthropic.com`.
- **Variables Preview existantes**, limitées à la branche : base Supabase de test `devis-scan-dev`. La Production n'a aucune variable.
- **Base de test** : migrations `20261202090000` (photos, cartons) et `20261203090000` (simulations) appliquées le 27/11/2026. Fonctions, colonnes, contraintes et droits ont été vérifiés identiques à la base locale.
- **Entreprise de test** `demenagements-demo-test` : grille enregistrée (45 €/m³, minimum 350 €), identité légale complète, catalogue de 134 références.
- **Tâches planifiées** : elles ne tournent pas en Preview. Une analyse n'est jamais relancée automatiquement après un échec.

## Chaîne de traitement

1. Le client importe ses photos. Le navigateur les réduit à 1 600 px et les convertit en JPEG (`src/lib/video/photo.ts`). Le serveur vérifie le format réel et les stocke dans le bucket privé `request-media`.
2. À l'envoi, l'analyse démarre en arrière-plan.
   - Toutes les photos de « Mon logement » sont prises dans l'ordre d'envoi : **60 au plus**, réparties uniformément au-delà.
   - Elles sont envoyées par lots de 20 images au plus, un appel par lot.
   - Chaque appel contient les consignes et le catalogue (mis en cache), puis demande une sortie JSON structurée.
3. Pour chaque objet, le modèle désigne un **identifiant du catalogue**, ou « autre ». Le serveur lit le volume dans `furniture_catalog`.
   - Objet sans volume de référence : dimensions estimées sur l'image × coefficient de manutention (`volume_source = dimensions`, à vérifier).
   - Sans dimensions : volume 0, à compléter par le déménageur. Aucun volume n'est inventé.
4. Un meuble repéré dans deux lots est signalé « doublon possible », jamais retiré. Le client tranche (« Éléments à vérifier »), puis le déménageur.
5. Le client indique ses cartons supplémentaires et corrige l'inventaire, puis valide. Le devis est calculé par `src/lib/pricing/engine.ts` avec la **grille de l'entreprise** : l'IA ne fournit aucun prix.

## Coût estimé (tarifs de `src/lib/ai/cost.ts`)

| Photos | Appels | Coût habituel | Maximum (sortie plafonnée atteinte) |
| --- | --- | --- | --- |
| 10 | 1 | ≈ 0,005 $ | ≈ 0,011 $ |
| 20 | 1 | ≈ 0,008 $ | ≈ 0,014 $ |
| 30 | 2 | ≈ 0,013 $ | ≈ 0,025 $ |
| 60 | 3 | ≈ 0,023 $ | ≈ 0,041 $ |

Ces montants sont recalculables hors ligne avec `node --conditions=react-server tests/ai-eval/preflight-photos.ts <nombre>`. Pour comparaison, le test réel du 25/11/2026 sur 8 images a coûté de 0,0019 $ à 0,0034 $ par appel. Le coût réel de chaque analyse s'affiche sur la fiche pro de la demande.

## Procédure

1. **Ajouter les variables dans Vercel**
   - Où : projet `devis-scan` → Settings → Environment Variables → Add.
   - Environnement : cocher **Preview uniquement**, puis choisir la branche `claude/trusting-wozniak-28f6ok`.

   | Nom | Valeur | Type |
   | --- | --- | --- |
   | `AI_PROVIDER` | `anthropic` | normal |
   | `AI_MODEL` | `claude-haiku-5-5` | normal |
   | `DEVIS_SCAN_ANTHROPIC_API_KEY` | votre clé (console.anthropic.com → API Keys) | **Sensitive** |

   Ne rien ajouter dans Production. Ne jamais copier la clé dans une conversation ni dans un fichier.
2. **Redéployer la Preview** : Deployments → dernier déploiement de la branche → ⋯ → Redeploy. Les variables ne s'appliquent qu'aux nouveaux déploiements.
3. **Ouvrir la Preview** sur le téléphone, connecté à votre compte Vercel (la Preview est protégée) : `https://devis-scan-git-claude-trusting-wozniak-28f6ok-mattis11.vercel.app/d/demenagements-demo-test`.
4. **Faire la demande**
   - « Filmer ou photographier mon logement » → « Importer des photos » (60 photos au plus).
   - Retirer les photos inutiles, puis « Valider et envoyer » → récapitulatif → « Envoyer ma demande ».
5. **Suivre l'analyse** sur la page de suivi : 1 à 3 minutes selon le nombre de photos. Puis :
   - indiquer les cartons supplémentaires ;
   - vérifier les objets rangés par pièce ;
   - répondre aux « Éléments à vérifier » ;
   - valider pour obtenir le devis.
6. **Contrôler dans l'espace pro** (fiche de la demande) :
   - modèle `claude-haiku-5-5`, aucun badge « simulation » ;
   - nombre d'images, jetons, coût réel ;
   - objets et volumes (catalogue / dimensions / inconnu), doublons signalés ;
   - devis calculé avec la grille.
7. **Comparer** avec l'inventaire du devis commercial déjà accepté : objets oubliés, objets en trop, mauvaises variantes (canapé 2 ou 3 places, lit simple ou double…), écart de volume.

## Limites connues avant le test

- Au-delà de 60 photos, toutes ne sont pas analysées : la sélection est répartie uniformément.
- Le catalogue branché est celui de 134 références. Le catalogue v6 (313 sous-catégories, variantes plus fines) n'est **pas** branché.
- Un objet absent du catalogue reçoit un volume calculé à partir des dimensions estimées par l'IA : ce volume est signalé et à vérifier.
- Les seuils de confiance n'ont pas encore été recalibrés sur de vrais logements.
