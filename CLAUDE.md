# Devis Scan — contexte du projet

SaaS B2B pour entreprises de déménagement : le particulier filme son logement, l'IA prépare l'inventaire et le volume, le déménageur vérifie et envoie son devis. Abonnement mensuel. « Devis Scan » est un **nom de travail**.

Le porteur du projet n'est pas développeur : expliquer en français simple, guider pas à pas pour toute action manuelle (comptes, clés, DNS), ne jamais présenter comme terminé ce qui n'est pas développé et testé, ne jamais simuler une fonctionnalité (pas de fausse IA, pas de fausses statistiques).

## Décisions validées

- **Charte graphique** (validée) : artifact « Charte Devis Scan ». Bleu confiance `#3050C8`, fonds blancs et gris bleutés, Plus Jakarta Sans (titres) + Inter (texte et chiffres), icônes Lucide, pas d'emoji. Tokens dans `src/app/globals.css` (`--ds-*`).
- **Confiance IA** : Sûr ≥ 85 % (vert), À vérifier 60–84 % (orange), Incertain < 60 % (rouge), Doublon possible (violet, indépendant du score). Pourcentages côté déménageur, libellés seuls côté particulier. Seuils à recalibrer après tests réels (`src/lib/inventory/confidence.ts`).
- **Volume** : confirmé (sûr ou validé par une personne) / à vérifier (compté) / potentiel (incertain ou doublon, **non compté**) ; fourchette = estimé → estimé + potentiel ; bandeau « Vérification humaine nécessaire » côté pro (`src/lib/inventory/volume.ts`).
- **Marque blanche** : la couleur de l'entreprise remplace seulement `brand` côté particulier (pages, e-mails, PDF), assombrie automatiquement si texte blanc illisible (`src/lib/company/color.ts`). Couleurs de confiance jamais modifiées. L'espace pro garde l'identité Devis Scan.
- **Nom, logo, signature du produit** : uniquement dans `src/config/brand.ts`.
- **Vidéos** : conservées (vidéos + images extraites), bucket privé, URL signées, compression dans le navigateur (720p), suppression réelle après 90 jours par défaut (réglable par entreprise, 7–365 j).
- **Particulier sans compte** : accès par jeton secret (hachage SHA-256 stocké, 30 jours) conservé dans un cookie httpOnly limité à `/d/<slug>` ; jamais d'identifiant dans les URL.
- **Vidéos** : compressées dans le navigateur (Mediabunny/WebCodecs, 720p, sans son) ; original envoyé si compression impossible ; l'original n'est pas stocké (reste sur le téléphone), ses caractéristiques le sont. Envoi TUS reprenable signé. Jusqu'à 8 images extraites par vidéo.
- **Paiement Stripe** : reporté après les premiers pilotes.
- **Analyse IA** : fournisseur interchangeable (`src/lib/ai/`), Claude (`AI_PROVIDER=anthropic`, `ANTHROPIC_API_KEY`, `AI_MODEL` **obligatoire**, aucun modèle imposé avant la comparaison réelle `tests/ai-eval/`). Sans configuration : aucune analyse, aucune dépense. Clé : `docs/connexion-cle-anthropic.md` (jamais dans la conversation). Simulateur (`AI_PROVIDER=simulation` + `AI_ALLOW_SIMULATION=1`) refusé hors base locale, résultats marqués `simulated` et signalés à l'écran. Voir `docs/analyse-ia.md`.
- **Catalogue** : `public.furniture_catalog` (134 références dont 52 sans volume, ABO CC BY 4.0 + prototype), volume géométrique ≠ volume de déménagement, aucune valeur inventée (`docs/catalogue-sources.md`). Régénérer : `python3 scripts/catalog/build_catalog.py` puis `node scripts/catalog/catalog-to-sql.mjs`.
- **Devis** : moteur pur en centimes (`src/lib/pricing/engine.ts`), uniquement la grille de l'entreprise, aucune estimation tant que la grille n'est pas enregistrée (`configured_at`). Chaque calcul = nouvelle version figée avec instantanés ; devis accepté verrouillé. Estimation automatique ≠ devis envoyé (identité légale requise). Devis formel automatique seulement si l'entreprise l'a activé (`companies.auto_formal_quotes`) et que toutes les conditions de fiabilité sont réunies (`src/lib/quotes/eligibility.ts`), sinon estimation + motifs de validation (`quotes.review_reasons`). Aucune nouvelle version après acceptation (déclencheur). Voir `docs/devis.md`.
- **Lien de suivi client** : `/d/<slug>/devis/<jeton>` (jeton de consultation, hachage en base), remis à l'envoi.
- **Mode démo personnalisé** pour la prospection : prévu (colonne `companies.is_demo` déjà présente).
- Branche de travail : `claude/trusting-wozniak-28f6ok`. Ne jamais modifier `main` ni fusionner sans autorisation explicite.

## Architecture

- **Next.js 16** (App Router, TypeScript, Tailwind 4). Lire `AGENTS.md` : l'API de Next 16 diffère (le middleware s'appelle `src/proxy.ts`). Le mode `cacheComponents` est **désactivé** volontairement (pages privées dépendantes de la session).
- **Supabase** : Postgres + Auth + Storage. Clients : `src/lib/supabase/server.ts` (session de l'utilisateur, RLS), `admin.ts` (clé secrète, serveur uniquement, tâches système), `proxy.ts` (rafraîchissement de session + redirections optimistes).
- **Sécurité en couches** : proxy (redirection) → `src/lib/auth/dal.ts` (`requireUser`, `requireMembership`, `canManageSettings`) dans chaque page et action → validation zod côté serveur (`src/lib/validation/`) → **RLS** en base (barrière finale). L'entreprise vient toujours de la session, jamais du navigateur.
- **Erreurs** : `src/lib/errors.ts` (messages français, détail journalisé côté serveur uniquement), `ActionState` pour les formulaires (`useActionState`), `error.tsx`.
- **Base de données** : voir `docs/base-de-donnees.md`. Migrations versionnées dans `supabase/migrations/` (jamais de modification manuelle). Types générés : `src/lib/supabase/database.types.ts` (`npm run db:types`).

## Arborescence utile

- `src/app/(auth)/` connexion, inscription, mot de passe ; `src/app/auth/confirm` liens e-mail.
- `src/app/espace/` espace déménageur : tableau de bord, demandes (liste, fiche, saisie manuelle), tarifs, entreprise, équipe, profil, bienvenue (création d'entreprise).
- `src/app/api/taches/purge-videos` purge RGPD ; `src/app/api/taches/analyses` reprise des analyses (Vercel Cron, `vercel.json`).
- `src/lib/ai/` analyse (sortie, post-traitement, coût, fournisseurs) ; `src/lib/analysis/run.ts` orchestration ; `src/lib/quotes/` génération, PDF ; `src/lib/pricing/engine.ts` tarif.
- `src/app/d/[slug]/devis/[token]/` suivi et devis du client (PDF : `pdf/route.ts`).
- `src/app/d/[slug]/` parcours du particulier (voir `docs/parcours-client.md`) : `load.ts` (entreprise + brouillon), `actions.ts` (formulaires), `video-actions.ts` (vidéos), `demande/<étape>/`.
- `src/lib/public-request/` session (cookie httpOnly du jeton), service (appels SQL protégés par jeton), erreurs, étapes.
- `src/lib/video/` compression Mediabunny, extraction et sélection d'images, envoi reprenable (TUS), contrôle du format réel.
- `src/lib/address/api.ts` API Adresse (Géoplateforme IGN).
- `src/components/ui/` composants de la charte ; `src/components/app/` coque de l'espace.
- `prototype/index.html` premier prototype, conservé pour référence (sa table de volumes et sa formule de prix ont été reprises).

## Conventions

- Interface et messages en français, vouvoiement, nombres au format français (`18,4 m³`, `1 640 €`).
- Formulaires : action serveur + `useActionState`, champs `TextField/SelectField/TextArea`, `fieldProps(state, name, défaut)` pour conserver la saisie après erreur (jamais les mots de passe).
- Modules testés par `node --test` : imports relatifs avec extension `.ts` (pas d'alias `@/`).
- Dépendances : version publiée depuis au moins deux semaines, version exacte.
- Commits réguliers et explicites en français.

## Commandes

```bash
npm run dev               # application (http://localhost:3000), nécessite .env.local
npm run db:start          # Supabase local (Docker) ; e-mails de test : http://127.0.0.1:54324
npm run db:reset          # recrée la base locale depuis les migrations
npm test                  # tests unitaires (node --test)
npm run test:db           # tests pgTAP d'isolation et du parcours sans compte
npm run test:integration  # stockage + purge (Supabase local + application lancée)
npm run test:e2e          # parcours de l'espace pro en navigateur (Playwright)
npm run test:media        # génère les vidéos de test (ffmpeg) dans tests/e2e/media/
npm run test:e2e:client   # parcours client complet (application lancée avec AI_PROVIDER=simulation AI_ALLOW_SIMULATION=1)
npm run lint && npx tsc --noEmit && npm run build
```

Dans l'environnement cloud de Claude : démarrer Docker (`dockerd &`), puis `SUPABASE_INTERNAL_IMAGE_REGISTRY=docker.io npx supabase start -x studio,realtime,edge-runtime,logflare,vector,supavisor,postgres-meta,imgproxy`. Pour l'e2e : `NODE_PATH=$(npm root -g) npm run test:e2e`.
Évaluation réelle des modèles : `tests/ai-eval/README.md` (environnement cloud « devis-scan », clé dans la variable `ANTHROPIC_API_KEY` de l'environnement, nouvelle session requise).

## Feuille de route

1. ✅ Phase 1 — socle Next.js, charte graphique.
2. ✅ Phase 2 — Supabase, authentification, multi-entreprises (RLS + tests), paramètres, tarifs, tableau de bord réel, saisie manuelle de demandes.
3. ✅ Phase 3 — parcours particulier `/d/[slug]` (trajet, logements, pièces, vidéos, récapitulatif), caméra et galerie, compression 720p, envoi reprenable, images extraites, fiche pro avec vidéos et images, purge des abandons. Reste : validation sur vrais iPhone/Android, e-mail de confirmation au client.
4. ✅ Phase 4 — catalogue mobilier sourcé, analyse IA (Claude, côté serveur ; simulateur réservé aux tests), dédoublonnage, inventaire corrigeable avec historique, tarif déterministe, devis versionnés, lien de suivi client, PDF, acceptation. Reste : tests avec une vraie clé sur de vrais logements, envoi des e-mails, revue juridique des mentions.
5. Phase 5 — démo personnalisée, invitations de collaborateurs, pages légales (CGU, confidentialité, contrat de sous-traitance RGPD).
6. Phase 6 — Stripe, nom et domaine définitifs.
