# Devis Scan — contexte du projet

SaaS B2B pour entreprises de déménagement : le particulier filme son logement, l'IA prépare l'inventaire et le volume, le déménageur vérifie et envoie son devis. Abonnement mensuel. « Devis Scan » est un **nom de travail**.

Le porteur du projet n'est pas développeur : expliquer en français simple, guider pas à pas pour toute action manuelle (comptes, clés, DNS), ne jamais présenter comme terminé ce qui n'est pas développé et testé, ne jamais simuler une fonctionnalité (pas de fausse IA, pas de fausses statistiques).

## Décisions validées

- **Charte graphique** (validée) : artifact « Charte Devis Scan ». Bleu confiance `#3050C8`, fonds blancs et gris bleutés, Plus Jakarta Sans (titres) + Inter (texte et chiffres), icônes Lucide, pas d'emoji. Tokens dans `src/app/globals.css` (`--ds-*`).
- **Confiance IA** : Sûr ≥ 85 % (vert), À vérifier 60–84 % (orange), Incertain < 60 % (rouge), Doublon possible (violet, indépendant du score). Pourcentages côté déménageur, libellés seuls côté particulier. Seuils à recalibrer après tests réels (`src/lib/inventory/confidence.ts`).
- **Volume** : confirmé (sûr ou validé par une personne) / à vérifier (compté, **y compris les doublons possibles**) / potentiel (incertain, **non compté**) ; fourchette = estimé → estimé + potentiel ; bandeau « Vérification humaine nécessaire » côté pro (`src/lib/inventory/volume.ts`).
- **Marque blanche** : la couleur de l'entreprise remplace seulement `brand` côté particulier (pages, e-mails, PDF), assombrie automatiquement si texte blanc illisible (`src/lib/company/color.ts`). Couleurs de confiance jamais modifiées. L'espace pro garde l'identité Devis Scan.
- **Dédoublonnage** (revu le 26/11/2026, `src/lib/ai/postprocess.ts`) : plusieurs meubles identiques sont normaux. On ne conclut jamais au même objet sur la seule catégorie, le nom ou la ressemblance. Deux entrées visibles sur une même image sont distinctes. On signale (sans retirer) en cas de doute explicite de l'IA (`identity_doubt`), ou pour une même référence précise jamais visible ensemble. « Autre objet » et « Sac ou ballot » ne sont jamais comparés. Le déménageur tranche (« Retirer » / « Pas un doublon », historisé).
- **Nom, logo, signature du produit** : uniquement dans `src/config/brand.ts`.
- **Vidéos** : conservées (vidéos + images extraites), bucket privé, URL signées, compression dans le navigateur (720p), suppression réelle après 90 jours par défaut (réglable par entreprise, 7–365 j).
- **Particulier sans compte** : accès par jeton secret (hachage SHA-256 stocké, 30 jours) conservé dans un cookie httpOnly limité à `/d/<slug>` ; jamais d'identifiant dans les URL.
- **Vidéos** : compressées dans le navigateur (Mediabunny/WebCodecs, 720p, sans son) ; original envoyé si compression impossible ; l'original n'est pas stocké (reste sur le téléphone), ses caractéristiques le sont. Envoi TUS reprenable signé. Jusqu'à 8 images extraites par vidéo.
- **Paiement Stripe** : reporté après les premiers pilotes.
- **Analyse IA** : fournisseur interchangeable (`src/lib/ai/`), Claude (`AI_PROVIDER=anthropic`, `DEVIS_SCAN_ANTHROPIC_API_KEY` — jamais `ANTHROPIC_API_KEY`, réservée par l'environnement cloud —, `AI_MODEL` **obligatoire**, aucun modèle imposé avant la comparaison réelle `tests/ai-eval/`). Sans configuration : aucune analyse, aucune dépense. Clé : `docs/connexion-cle-anthropic.md` (jamais dans la conversation). Client unique `src/lib/ai/anthropic-client.ts` : adresse `https://api.anthropic.com` imposée, tout autre hôte refusé. Simulateur (`AI_PROVIDER=simulation` + `AI_ALLOW_SIMULATION=1`) refusé hors base locale, résultats marqués `simulated` et signalés à l'écran. Voir `docs/analyse-ia.md`.
- **Catalogue** : `public.furniture_catalog` (134 références dont 52 sans volume, ABO CC BY 4.0 + prototype), volume géométrique ≠ volume de déménagement, aucune valeur inventée (`docs/catalogue-sources.md`). Régénérer : `python3 scripts/catalog/build_catalog.py` puis `node scripts/catalog/catalog-to-sql.mjs`. Catalogue **préparatoire** non branché (ni base, ni IA) : `data/catalogue-v3/` (46 familles, 311 sous-catégories, ABO CC BY 4.0 + Wikidata et musées CC0, niveau de droits par observation ; v2 conservée dans `data/catalogue-v2/`), scripts `scripts/catalogue_v3/`. **v4** (26/11/2026) : `data/catalogue-v4/` + `scripts/catalogue_v4/` — pertinence déménagement (4 niveaux, `pertinence.py`), électroménager ENERGY STAR (domaine public), objets anciens exclus des sous-catégories actuelles, dimensions partielles, audit des dimensions ; 132/171 prioritaires complètes (objectif 80 % non atteint, piste EPREL en attente d'accord pour une clé). Voir `PROGRESSION.md`. **v5** (27/11/2026) : `data/catalogue-v5/` + `scripts/catalogue_v5/` — consolidation sans nouvelle collecte : 151 corrections de dimensions justifiées et traçables (`corrections.py`), statut d'orientation, mesurabilité et champs de transport (aucun coefficient), étude EPREL (clé obligatoire, déclaration signée ; démarche à faire par le porteur du projet, `rapport_eprel.md`), scripts EPREL prêts et inactifs ; prioritaires toujours 132/171. **Préparation de l'intégration au moteur IA** (26/11/2026, non branchée) : `docs/preparation-integration-catalogue/` (EPREL : conditions officielles lues, guide de demande ; architecture de recherche ; contrat commun 2.0 `contrat_commun_ia.json` ; fournisseurs interchangeables ; plan) et prototype testé `prototypes/integration-catalogue/` (`node --test "prototypes/integration-catalogue/*.test.ts"`). Le modèle désigne un identifiant existant, le serveur lit les volumes dans le catalogue ; géométrique et déménagement toujours séparés.
- **Devis** : moteur pur en centimes (`src/lib/pricing/engine.ts`), uniquement la grille de l'entreprise, aucune estimation tant que la grille n'est pas enregistrée (`configured_at`). Chaque calcul = nouvelle version figée avec instantanés ; devis accepté verrouillé. Estimation automatique ≠ devis envoyé (identité légale requise). Demandes du lien client : devis final après la validation du client (voir ci-dessous) ; l'ancienne option `companies.auto_formal_quotes` n'est plus utilisée (colonne conservée). Demandes saisies à la main : recalcul puis envoi par le déménageur. Après acceptation : seul un avenant soumis au client (déclencheur). Voir `docs/devis.md`.
- **Validation client et devis final** (26/11/2026, `docs/devis.md`) : après l'analyse, le client valide son inventaire. Il répond obligatoirement à chaque « Élément à vérifier » et accepte l'avertissement (texte dans `src/lib/inventory/duplicates.ts`). Le devis final est alors transmis immédiatement et peut être accepté sans attendre le déménageur. Le déménageur vérifie en parallèle (`verification_status`, indépendant du devis) :
  - s'il confirme : rien ne change pour le client ;
  - s'il corrige : recalcul et comparaison des conditions → trace seule si elles sont identiques, nouvelle version si le devis n'est pas accepté, **avenant** si le devis est accepté (devis accepté immuable et en vigueur, avenant jamais accepté d'office).

  Les réponses du client ne sont jamais écrasées (colonnes séparées, déclencheur). E-mails préparés dans `customer_notifications` : **aucun service d'e-mail configuré**, jamais présentés comme envoyés.
- **Lien de suivi client** : `/d/<slug>/devis/<jeton>` (jeton de consultation, hachage en base), remis à l'envoi.
- **Parcours client v2** (01/12/2026, `docs/parcours-client.md`, migration `20261201090000_customer_journey_v2.sql`) : 1 Déménagement (étage obligatoire avec rez-de-chaussée, dates alternatives multiples `alternative_moving_dates`, l'ancienne colonne garde la première) → 2 Coordonnées (particulier / entreprise, SIRET facultatif, téléphone obligatoire, accord au traitement obligatoire et daté, offres facultatives) → 3 Méthode (`inventory_method` : video / manual) → 4 vidéos ou inventaire manuel par 7 catégories (`src/lib/inventory/manual.ts`) → 5 Récapitulatif. Manuel : validation à l'envoi (avertissement sans « vidéos », `MANUAL_INVENTORY_WARNING`) et devis final immédiat, sans IA. Vidéo : inventaire de l'analyse modifiable par le client avant validation (historisé) ; analyse impossible → le client complète lui-même (`public_resume_manual`). Objets du client : volume catalogue, sinon dimensions × coefficient, sinon taille approximative = volume catalogue d'un objet comparable (`volume_source = comparable`, justification `volume_note`) ; jamais de volume arbitraire.
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
npm run test:e2e:verification  # validation client, devis final, vérification du déménageur (cas 1, A, C)
npm run test:e2e:manuel   # parcours client « inventaire manuel » jusqu'au devis accepté (application lancée)
npm run lint && npx tsc --noEmit && npm run build
```

Dans l'environnement cloud de Claude : démarrer Docker (`dockerd &`), puis `SUPABASE_INTERNAL_IMAGE_REGISTRY=docker.io npx supabase start -x studio,realtime,edge-runtime,logflare,vector,supavisor,postgres-meta,imgproxy`. Pour l'e2e : `NODE_PATH=$(npm root -g) npm run test:e2e`.
Évaluation réelle des modèles : `tests/ai-eval/PROTOCOLE.md` et `tests/ai-eval/README.md` (environnement cloud « devis-scan », clé dans la variable `DEVIS_SCAN_ANTHROPIC_API_KEY` de l'environnement, nouvelle session requise ; `ping.ts --check` et `bench.ts` sans `--confirm` vérifient sans appel). Jeu de données : `tests/ai-eval/dataset/<cas>/`. Budget : 0,75 $ par modèle (premier benchmark), plafond absolu de campagne 5 $ (`src/lib/ai/benchmark/budget.ts`, registre `tests/ai-eval/results/ledger.json` à committer). **Aucun appel réel sans accord explicite du porteur du projet.** Ne jamais lancer l'application avec `AI_PROVIDER` pour préparer des images.

## Feuille de route

1. ✅ Phase 1 — socle Next.js, charte graphique.
2. ✅ Phase 2 — Supabase, authentification, multi-entreprises (RLS + tests), paramètres, tarifs, tableau de bord réel, saisie manuelle de demandes.
3. ✅ Phase 3 — parcours particulier `/d/[slug]` (trajet, logements, pièces, vidéos, récapitulatif), caméra et galerie, compression 720p, envoi reprenable, images extraites, fiche pro avec vidéos et images, purge des abandons. Reste : validation sur vrais iPhone/Android, e-mail de confirmation au client.
4. ✅ Phase 4 — catalogue mobilier sourcé, analyse IA (Claude, côté serveur ; simulateur réservé aux tests), dédoublonnage, inventaire corrigeable avec historique, tarif déterministe, devis versionnés, lien de suivi client, PDF, acceptation. Validation de l'inventaire par le client, devis final immédiat, vérification du déménageur avec nouvelles versions et avenants (26/11/2026). Reste : tests avec une vraie clé sur de vrais logements, **branchement d'un service d'e-mail** (messages déjà préparés), revue juridique des mentions (avertissement client et avenants compris).
5. Phase 5 — démo personnalisée, invitations de collaborateurs, pages légales (CGU, confidentialité, contrat de sous-traitance RGPD).
6. Phase 6 — Stripe, nom et domaine définitifs.
