# Devis Scan

Logiciel SaaS pour les entreprises de déménagement : le particulier filme son logement, l'IA prépare l'inventaire et le volume, le déménageur vérifie et envoie son devis.

« Devis Scan » est un nom de travail : le nom et la signature se changent dans `src/config/brand.ts`, les couleurs dans `src/app/globals.css`.

## État actuel (phase 1)

- Socle technique Next.js et charte graphique appliquée.
- Page d'accueil et page interne de contrôle des composants (`/charte`).
- Calcul du volume (confirmé / à vérifier / potentiel, fourchette, vérification humaine), testé.
- Les données affichées sont **fictives** et signalées comme telles. Pas encore de comptes, de base de données, de vidéos ni d'IA.

L'ancien prototype est conservé tel quel dans `prototype/index.html`.

## Commandes

```bash
npm install        # installer les dépendances
npm run dev        # lancer en local sur http://localhost:3000
npm test           # tests de la logique métier
npm run lint       # contrôle du code
npm run build      # construction de production
```

## Organisation

- `src/app/` : pages (accueil, `/charte`).
- `src/components/ui/` : composants de la charte (boutons, badges, alertes, champs, cartes).
- `src/components/inventory/` : composants d'inventaire et de volume.
- `src/lib/inventory/` : logique métier (catalogue des volumes, niveaux de confiance, calcul du volume) et ses tests.
- `src/config/brand.ts` : identité du produit.
