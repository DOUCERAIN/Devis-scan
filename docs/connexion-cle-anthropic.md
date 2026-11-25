# Connecter une vraie clé API Anthropic

La clé ne doit **jamais** être écrite dans la conversation, dans le code ni dans GitHub. Elle se saisit uniquement dans les écrans de réglages prévus pour cela.

## 1. Créer la clé (une fois)

1. Ouvrez https://console.anthropic.com et connectez-vous (ou créez un compte pour votre entreprise).
2. **Billing** : ajoutez un moyen de paiement et un crédit (5 $ suffisent largement pour les tests : la comparaison complète des trois modèles est estimée à 0,75 $ au plus).
3. **Limits** : fixez une limite de dépense mensuelle (par exemple 10 $) : au-delà, les appels sont refusés, il n'y a pas de mauvaise surprise.
4. **API Keys** → **Create Key**. Nommez-la `devis-scan-tests`. Copiez-la : elle ne s'affiche qu'une fois. Conservez-la dans votre gestionnaire de mots de passe.

Conseil : créez plus tard une **deuxième clé** `devis-scan-production` pour Vercel, afin de pouvoir révoquer l'une sans couper l'autre.

## 2. Pour les tests réels avec Claude Code (environnement cloud « devis-scan »)

Le coffre à secrets de l'environnement cloud ne fonctionne pas pour les serveurs d'Anthropic : la clé doit être placée dans une **variable d'environnement** de l'environnement.

1. Sur claude.ai/code, ouvrez une session de ce dépôt, cliquez sur le nom de l'environnement dans la barre de titre de la session, choisissez **devis-scan**, puis **Modifier** (Edit).
2. Dans **Variables d'environnement**, ajoutez :
   ```
   ANTHROPIC_API_KEY=votre_clé
   ```
   Saisissez la clé **dans ce champ**, jamais dans la conversation.
3. Enregistrez, puis démarrez une **nouvelle session** sur l'environnement devis-scan (la variable n'est lue qu'au démarrage d'une session).
4. Demandez à Claude : « Lance la comparaison réelle des modèles ». Il exécutera :
   ```
   node --conditions=react-server tests/ai-eval/bench.ts --confirm
   ```
   Le script affiche d'abord l'estimation du coût et refuse de dépasser le plafond (`--max-usd`, 5 $ par défaut).

À savoir : cette variable est lisible par les commandes lancées dans les sessions de cet environnement (il est personnel : vous seul l'utilisez). Une fois les tests terminés, vous pouvez supprimer la variable, ou révoquer la clé dans la console Anthropic.

## 3. Pour la production (Vercel)

1. Vercel → votre projet → **Settings** → **Environment Variables**.
2. Ajoutez, pour l'environnement **Production** :

   | Nom | Valeur |
   | --- | --- |
   | `ANTHROPIC_API_KEY` | la clé `devis-scan-production` (cochez **Sensitive**) |
   | `AI_PROVIDER` | `anthropic` |
   | `AI_MODEL` | le modèle choisi après la comparaison (`claude-haiku-5-5`, `claude-sonnet-5-5` ou `claude-opus-5-5`) |
   | `AI_EFFORT` | `medium` |

3. **Deployments** → dernier déploiement → **Redeploy** (les variables ne sont prises en compte qu'au déploiement suivant).

Sans `AI_MODEL`, l'analyse ne démarre pas (aucun modèle n'est imposé par défaut) : la fiche de la demande affiche « modèle IA non choisi ».

## 4. Vérifier que tout fonctionne

- Envoyez une demande de test depuis votre lien client avec une vraie vidéo.
- Sur la fiche de la demande (espace pro), le bloc **Analyse automatique** doit indiquer « Terminée », le modèle utilisé, les jetons consommés et le **coût estimé**.
- En cas d'échec, le motif s'affiche (clé absente, modèle non choisi, fournisseur indisponible…).

## Sécurité

- La clé n'est utilisée que par le serveur ; elle n'est jamais envoyée au navigateur (aucune variable `NEXT_PUBLIC_`).
- `.env.local` (développement) n'est jamais versionné.
- En cas de doute (clé partagée par erreur) : révoquez-la immédiatement dans la console Anthropic et créez-en une nouvelle.
