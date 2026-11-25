# Pertinence et couverture métier — catalogue Devis Scan v5

Les quatre niveaux de la v4 sont conservés (`scripts/catalogue_v5/pertinence.py`) : 1 courant, 2 complémentaire, 3 spécifique ou exceptionnel, 4 peu pertinent. **Appréciation qualitative de Devis Scan, pas une fréquence observée.**

## Indicateurs demandés

| # | Indicateur | Valeur |
| --- | --- | ---: |
| 1 | Sous-catégories documentées (au moins une dimension plausible) | 237 / 311 |
| 2 | Sous-catégories à trois dimensions complètes | 228 / 311 |
| 3 | Sous-catégories avec au moins trois modèles indépendants | 181 |
| 4 | Sous-catégories statistiquement fiables (≥ 5 modèles, ≥ 2 sources indépendantes) | 156 |
| 5 | Couverture des catégories courantes (niveau 1) | 77 / 87 (88,5 %) ; fiables : 61 |
| 6 | Couverture globale | 228 / 311 (73,3 %) |
| 7 | Catégories encore insuffisamment documentées (moins de 3 modèles) | 130 (liste dans `rapport_couverture.md`) |

## Couverture des sous-catégories prioritaires : deux dénominateurs

- **Dénominateur historique (171, jamais modifié)** : 132 / 171 = **77,2 %**.
- **Sous-catégories prioritaires mesurables** : 132 / 169 = **78,1 %**. Exclues de ce second dénominateur, et seulement elles :
  - `CAR-SAC` Sac, ballot ou housse remplis : sac, ballot ou housse remplis : le volume dépend entièrement du contenu et du remplissage
  - `DIV-AUTRE` Objet non classé : objet non classé : par définition, aucune forme ni taille de référence ; volume à saisir objet par objet
- Les sous-catégories à **méthode spécifique** (tapis roulés, lits démontés, parasols, abris…) restent dans les deux dénominateurs : elles ont une boîte englobante réelle ; seule leur conversion en volume de transport diffère.

## Couverture par niveau

| Niveau | Sous-catégories | 3 dimensions | Fiables | Partielles | Aucune donnée |
| --- | ---: | ---: | ---: | ---: | ---: |
| 1 — courant | 87 | 77 (88,5 %) | 61 | 5 | 5 |
| 2 — complémentaire | 139 | 89 (64,0 %) | 54 | 4 | 46 |
| 3 — spécifique ou exceptionnel | 66 | 48 (72,7 %) | 34 | 0 | 18 |
| 4 — peu pertinent pour un inventaire classique | 19 | 14 (73,7 %) | 7 | 0 | 5 |

Les objets de musée et les équipements rares ne masquent pas les manques : ils n'entrent pas dans les statistiques des sous-catégories actuelles (règle des objets anciens), et la couverture est publiée niveau par niveau. L'indicateur pondéré (poids 4 / 2 / 1 / 0) vaut 77,2 % ; c'est une appréciation, jamais une statistique.

## Catégories courantes encore insuffisantes

| Sous-catégorie | État | Modèles |
| --- | --- | ---: |
| `ELM-REF-1P` Réfrigérateur une porte | partielle, fiabilité non vérifiée | 0 |
| `ARM-1P` Armoire 1 porte | complète, fiabilité faible | 3 |
| `LIT-BEBE` Lit bébé | aucune, fiabilité non vérifiée | 0 |
| `SOM-STD` Sommier | complète, fiabilité faible | 13 |
| `TAB-6` Table à manger 6 personnes | complète, fiabilité faible | 1 |
| `TAB-4` Table à manger 2 à 4 personnes | complète, fiabilité faible | 2 |
| `RAN-BUFFET-HAUT` Buffet haut ou vaisselier | complète, fiabilité faible | 1 |
| `RAN-BIB-HAUTE` Bibliothèque haute | complète, fiabilité faible | 4 |
| `CUI-BUFFET` Buffet ou colonne de cuisine | complète, fiabilité faible | 4 |
| `CUI-ETAGERE` Étagère de cuisine ou micro-ondes | aucune, fiabilité non vérifiée | 0 |
| `ELM-REF-COMBI` Réfrigérateur combiné (congélateur en bas) | partielle, fiabilité non vérifiée | 0 |
| `ELM-REF-TOP` Réfrigérateur table top ou mini-réfrigérateur | partielle, fiabilité non vérifiée | 0 |
| `ELM-REF` Réfrigérateur | complète, fiabilité faible | 2 |
| `ELM-CONG` Congélateur | partielle, fiabilité non vérifiée | 0 |
| `ELM-LV` Lave-vaisselle | partielle, fiabilité non vérifiée | 0 |
| `ELM-FOUR` Four | complète, fiabilité faible | 1 |
| `INF-TV-55` Téléviseur 50 à 65 pouces | aucune, fiabilité non vérifiée | 0 |
| `INF-TV-43` Téléviseur 40 à 49 pouces | complète, fiabilité faible | 3 |
| `INF-TV-32` Téléviseur jusqu'à 39 pouces | complète, fiabilité faible | 1 |
| `INF-ORDI` Ordinateur fixe, écran ou poste de travail | complète, fiabilité faible | 2 |
| `SDB-VASQUE` Meuble sous-vasque | complète, fiabilité faible | 2 |
| `SDB-ARMOIRE` Armoire de toilette ou meuble suspendu | complète, fiabilité faible | 4 |
| `SDB-COLONNE` Colonne de salle de bain | aucune, fiabilité non vérifiée | 0 |
| `JAR-TABLE` Table de jardin | complète, fiabilité faible | 1 |
| `CAR-SAC` Sac, ballot ou housse remplis | aucune, fiabilité non vérifiée | 0 |
| `CAR-CARTON` Carton de déménagement | complète, fiabilité faible | 1 |

## Mesurabilité et transport

- Mesurables : 287 ; méthode spécifique : 21 ; non directement mesurables : 3.
- Démontables ou pliables : 76 ; empilables : 8. Champs `volume_transport_peut_differer`, `facteur_conversion_demenagement` (vide) et `convention_volume_demenagement` (« non définie ») : voir `architecture_catalogue.md`.
