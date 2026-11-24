# Devis Scan

Logiciel SaaS pour les entreprises de déménagement : le particulier filme son logement, l'IA prépare l'inventaire et le volume, le déménageur vérifie et envoie son devis.

« Devis Scan » est un nom de travail : le nom et la signature se changent dans `src/config/brand.ts`, les couleurs dans `src/app/globals.css`.

## État actuel (phase 3 développée et testée en local)

- Charte graphique appliquée (page de contrôle : `/charte`).
- Base de données multi-entreprises avec règles d'isolation (RLS) testées, stockage privé des logos, vidéos et images.
- Comptes déménageurs, espace entreprise (tableau de bord, demandes, paramètres, tarifs, équipe).
- **Parcours particulier sans compte** sur `/d/<entreprise>` : trajet avec suggestions d'adresses, logements, pièces, tournage des vidéos (caméra ou galerie), compression, images extraites, envoi reprenable, récapitulatif et envoi.
- Fiche demande côté déménageur : informations, logements, pièces, vidéos, images extraites.
- Pas encore d'analyse IA ni de calcul de devis automatique (phase 4).

Documentation : `CLAUDE.md` (décisions et architecture), `docs/base-de-donnees.md`, `docs/parcours-client.md`, `docs/mise-en-production.md`.

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
npm run test:e2e          # parcours de l'espace pro dans un navigateur
npm run test:media        # vidéos de test (nécessite ffmpeg)
npm run test:e2e:client   # parcours client complet (caméra simulée, compression, erreurs)
npm run build             # construction de production
```

## Organisation

- `src/app/` : pages (accueil, authentification, espace déménageur `/espace`, tâche de purge).
- `src/components/` : composants de la charte (`ui/`), coque de l'espace (`app/`), demandes, inventaire.
- `src/lib/` : accès aux données et à l'identité, validation, erreurs, logique métier (volumes, confiance, couleurs), Supabase.
- `supabase/migrations/` : schéma de la base ; `supabase/tests/` : tests de sécurité.
- `tests/` : tests d'intégration et de bout en bout.
- `src/config/brand.ts` : identité du produit.
