# Prototype — recherche dans le catalogue v5 et contrat IA commun

**Inactif** : aucun import depuis `src/`, aucun appel réseau, aucun modèle réel. Documentation : `docs/preparation-integration-catalogue/`.

| Fichier | Rôle |
| --- | --- |
| `construire_index.py` | génère `index_catalogue_v5.json` depuis `data/catalogue-v5/` (lecture seule) |
| `catalogue.ts` | types et chargement de l'index |
| `recherche.ts` | recherche structurée des références candidates (scores justifiés) |
| `contrat.ts` | contrat 2.0 (zod) et enveloppe serveur |
| `generer_schema.ts` | produit `docs/preparation-integration-catalogue/contrat_commun_ia.json` |
| `resolution.ts` | vérification des identifiants, volumes lus dans le catalogue (géométrique et déménagement séparés) |
| `compat_v1.ts` | relecture des réponses V1 actuelles |
| `fournisseurs.ts` | interface fournisseur, secours, rejeu, comparaison, fournisseur simulé |
| `consignes.ts` | consignes v2 et catalogue compact versionnés |
| `cas_tests.json`, `integration.test.ts` | 15 cas et 34 tests |

```bash
python3 prototypes/integration-catalogue/construire_index.py
node --test "prototypes/integration-catalogue/*.test.ts"
```
