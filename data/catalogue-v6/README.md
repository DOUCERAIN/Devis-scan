# Catalogue Devis Scan v6.2 — volumes de référence (version candidate)

Version 6.2 candidate, non commitée, construite le 26/11/2026 à partir du catalogue v5. La v5 n'est pas modifiée.

**Rien n'est branché** : ni la base de données, ni le moteur IA, ni le moteur de devis, ni le parcours client.

Le catalogue donne, pour chacune des 313 sous-catégories (311 issues de la v5, 2 créées en v6.2), deux volumes distincts :
- un **volume géométrique** : mesuré, partiellement mesuré ou estimé par l'IA ;
- un **volume de déménagement retenu**, choisi dans cet ordre de priorité :
  1. valeur publiée par Démén'House ;
  2. autre source professionnelle attribuée ;
  3. valeur non attribuée ;
  4. sous-catégorie comparable ;
  5. ratio de classe.

Convention : meubles comptés montés et complets. Le carton vaut 0,10 m³ (convention validée). Aucune valeur n'est validée par un professionnel.

| Document | Contenu |
| --- | --- |
| `rapport_final_v6_2.md` | décisions, corrections, limites et points bloquants de la v6.2 |
| `rapport_final_v6_1.md` | rapport de la v6.1 (historique) |
| `revue_40_categories.md` | document pour l'échange avec un déménageur |
| `CHANGELOG.md` | historique des versions |
| `rapport_avancement.md` | rapport de la v6.0, conservé pour l'historique |

**Reconstruction** :

```bash
python3 scripts/catalogue_v6/enrichir.py
```

```bash
python3 scripts/catalogue_v6/revue.py
```

**Contrôles** :

```bash
python3 -m unittest scripts/catalogue_v6/test_enrichir.py
```
