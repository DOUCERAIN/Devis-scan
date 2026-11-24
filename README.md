# Devis Scan

Logiciel SaaS pour les entreprises de déménagement : le particulier filme son logement, l'IA prépare l'inventaire et le volume, le déménageur vérifie et envoie son devis.

« Devis Scan » est un nom de travail : le nom et la signature se changent dans `src/config/brand.ts`, les couleurs dans `src/app/globals.css`.

## État actuel (phase 2 terminée)

- Charte graphique appliquée (page de contrôle : `/charte`).
- Connexion à Supabase : base de données multi-entreprises avec règles d'isolation (RLS) testées, stockage des logos et des vidéos.
- Comptes déménageurs : inscription avec confirmation par e-mail, connexion, mot de passe oublié, profil.
- Espace entreprise : tableau de bord sur données réelles, demandes (liste, fiche, saisie manuelle, statuts, notes, historique), informations, logo, couleur, conditions de devis, tarifs et options, équipe.
- Parcours particulier sans compte : base de données, fonctions sécurisées et stockage prêts ; **l'interface sera construite en phase 3**.
- Pas encore d'analyse IA ni de calcul de devis automatique.

Documentation : `CLAUDE.md` (décisions et architecture), `docs/base-de-donnees.md`, `docs/mise-en-production.md`.

L'ancien prototype est conservé tel quel dans `prototype/index.html`.

## Commandes

```bash
npm install               # installer les dépendances
cp .env.example .env.local  # puis renseigner les valeurs
npm run db:start          # Supabase local (nécessite Docker)
npm run dev               # application sur http://localhost:3000
npm test                  # tests unitaires
npm run test:db           # tests de sécurité de la base (isolation entre entreprises)
npm run test:integration  # stockage des vidéos et purge
npm run test:e2e          # parcours complets dans un navigateur
npm run build             # construction de production
```

## Organisation

- `src/app/` : pages (accueil, authentification, espace déménageur `/espace`, tâche de purge).
- `src/components/` : composants de la charte (`ui/`), coque de l'espace (`app/`), demandes, inventaire.
- `src/lib/` : accès aux données et à l'identité, validation, erreurs, logique métier (volumes, confiance, couleurs), Supabase.
- `supabase/migrations/` : schéma de la base ; `supabase/tests/` : tests de sécurité.
- `tests/` : tests d'intégration et de bout en bout.
- `src/config/brand.ts` : identité du produit.
