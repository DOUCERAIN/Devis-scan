# Tableau de bord — catalogue Devis Scan v5 (préparatoire)

Généré par `scripts/catalogue_v5/rapports.py`. Aucune nouvelle collecte en v5 : consolidation des données v2 à v4.

| Indicateur | v4 | v5 |
| --- | ---: | ---: |
| Observations | 30 215 | 30 215 |
| Modèles indépendants (utilisables) | 24 475 (9 971) | 24 466 (9 971) |
| Observations utilisables pour un volume | 13 851 | 13 871 |
| **Prioritaires à 3 dimensions — dénominateur historique** | 132 / 171 (77,2 %) | **132 / 171 (77,2 %)** |
| **Prioritaires à 3 dimensions — sous-catégories mesurables** | — | **132 / 169 (78,1 %)** |
| 1. Sous-catégories documentées (au moins une dimension) | — | 237 / 311 |
| 2. Sous-catégories à 3 dimensions complètes | — | 228 / 311 |
| 3. Sous-catégories avec au moins 3 modèles indépendants | — | 181 |
| 4. Sous-catégories statistiquement fiables (moyenne ou élevée) | 156 | 156 |
| 5. Couverture des catégories courantes (3 dimensions) | — | 77 / 87 (88,5 %) |
| 6. Couverture globale (3 dimensions) | — | 228 / 311 (73,3 %) |
| Catégories spécifiques et peu pertinentes (3 dimensions) | — | 62 / 85 (72,9 %) |
| Références exploitables par le moteur IA | 149 | 148 |
| Corrections de dimensions justifiées | — | 151 |
| Orientations ambiguës (exclues des dimensions médianes) | 1 652 « suspectes » | 1 121 |
| Indicateur pondéré par la pertinence (appréciation qualitative, pas une fréquence) | 77,2 % | 77,2 % |

Objectif de 80 % : **non atteint** — 132 / 171 sur le dénominateur historique (il en faudrait 137), 132 / 169 sur les sous-catégories mesurables (il en faudrait 136). Les exclusions du second dénominateur sont justifiées dans `rapport_pertinence.md`. Aucune donnée n'a été fabriquée.
