# Catalogue Devis Scan v6.2 (version candidate) — rapport final

**Date** : 26/11/2026. **Périmètre** : uniquement `data/catalogue-v6/` et `scripts/catalogue_v6/`.

**Ce qui n'a pas été modifié** : la v5, Supabase, le moteur de devis, le parcours client, les appels à l'IA, la production. Rien n'est commité.

**Retour en arrière** : les versions v6.0 et v6.1 restent dans `historique/`, avec les scripts de la v6.1.

**Aucune valeur n'a été vérifiée par un professionnel du déménagement.** Seules six conventions commerciales ont été validées, par le porteur du projet :
- carton standard : 0,10 m³ ;
- bac de rangement : 0,10 m³ ;
- grand bac de rangement : 0,20 m³ ;
- valise classique : 0,20 m³ ;
- grande valise : 0,30 m³ ;
- très grande valise : 0,30 m³.

**Catalogue : 313 sous-catégories**, dont 228 prioritaires : les 311 de la v5, avec leurs identifiants inchangés, et 2 créées en v6.2.

---

## 1. Décisions appliquées

| Décision | Application dans la v6.2 |
| --- | --- |
| Meubles comptés **montés et complets**, dans leur état normal | Convention écrite dans le catalogue ; un lit = cadre + sommier + matelas. Seuls les objets rangés pliés par nature (parasol fermé, tente dans sa housse, trampoline démonté…) gardent leur volume de rangement habituel. |
| Pas de calage, de protection ni de vide de chargement | Le ratio utilisé pour estimer un volume à partir des dimensions est recalculé sur **toutes** les valeurs professionnelles retenues, et non plus sur Démén'House seul. En v6.1, ce ratio valait 2,1 à 2,7, ce qui revenait à ajouter des marges ; il vaut maintenant 1,5 à 1,7 pour les meubles. |
| Carton standard = **0,10 m³** | Vérifié dans le CSV, le JSON, les variantes et les inventaires. |
| Conventions des bacs et des valises (dernière correction) | Bac de rangement (`CAR-BAC`) **0,10 m³**, valise classique (`BAG-VALISE`) **0,20 m³**, grande valise (`BAG-VALISE-GRANDE`) **0,30 m³**. Ce sont des conventions propres à chaque objet : ils ne sont **pas assimilés à des cartons** et gardent leurs sous-catégories et leurs identifiants. |
| Création de deux sous-catégories (à votre demande) | `CAR-BAC-GRAND` « Grand bac de rangement » **0,20 m³** et `BAG-VALISE-TRES-GRANDE` « Très grande valise » **0,30 m³**. Avant la création, j'ai vérifié qu'aucune sous-catégorie ni variante existante ne les couvrait. Elles sont définies dans `scripts/catalogue_v6/nouvelles_sous_categories.py` ; la v5 n'est pas modifiée. Leur volume géométrique n'est qu'une indication (modèle type estimé par l'IA, 0,18 et 0,15 m³) : le volume retenu est la convention. |
| Priorité à Démén'House, jamais de moyenne | Démén'House publie deux séries. Quand sa liste sort de la fourchette de son propre article récent, on retient la **borne publiée** la plus proche : commode 1,0 m³, chevet 0,25 m³, lit double 2,5 m³. |
| La géométrie est un indicateur, pas une règle | La règle v6.1 « au moins 80 % du volume géométrique » est retirée. Seules les valeurs **manifestement aberrantes** sont écartées : moins de 0,25 fois ou plus de 6 fois le volume géométrique médian mesuré sur au moins 3 produits. |
| Les divergences ne bloquent pas | État « choix documenté » : la valeur retenue suit la règle de priorité, et les autres valeurs restent visibles. |

---

## 2. Corrections apportées (v6.1 → v6.2)

**218 sous-catégories modifiées**, dont 137 prioritaires, plus **2 sous-catégories créées** et **3 variantes de valise corrigées**. Le détail se trouve dans `corrections_v6_2.csv` : valeur initiale, valeur proposée, raison, source ou méthode, et niveau de confiance (« moyenne » quand la valeur est publiée, « faible » quand elle est estimée).

| Correction | Nombre | Exemples (v6.1 → v6.2, en m³) | Source ou méthode | Confiance |
| --- | ---: | --- | --- | --- |
| Cohérence entre les deux publications de Démén'House | 3 | commode 1,5 → **1,0** ; chevet 0,3 → **0,25** ; lit double 2,6 → **2,5** | borne de la fourchette publiée par Démén'House | moyenne |
| Effets en chaîne sur les sous-catégories voisines | 9 | commodes 3, 4, 5 tiroirs et grande commode (1,02 → 0,68 ; 0,90 → 0,60 ; 1,30 → 0,87 ; 1,82 → 1,21) ; lit 160 2,99 → **2,88** ; lit 180 3,44 → 3,31 ; lit coffre 3,89 → 3,74 | sous-catégorie comparable | faible |
| Conventions des bacs et des valises | 3 | bac de rangement 0,146 → **0,10** ; valise classique 0,167 → **0,20** ; grande valise 0,316 → **0,30** | conventions commerciales validées par Devis Scan (non assimilées au carton) | élevée (convention validée) |
| Valeurs publiées réintégrées | 2 | transat 2,02 → **0,55** ; cuisinière 0,6 → **0,4** | valeur publiée (non attribuée), écartée en v6.1 par la règle des 80 % | moyenne |
| Estimations par les dimensions recalculées | 201 | bureau d'angle 2,79 → **2,00** ; meuble à chaussures 0,69 → 0,44 ; étagère métallique 0,98 → 0,70 ; sommier 1,44 → 1,03 ; armoire ancienne 4,67 → 2,95 | dimensions × ratio de la classe, calculé sur toutes les valeurs professionnelles | faible |

**Autres corrections**
- **Variantes des valises** (dernière correction) :
  - « petit format » (`BAG-VALISE-C`) et « format courant » (`BAG-VALISE-S`) : valise classique, **0,20 m³** (v6.1 : 0,106 et 0,164 m³) ;
  - « grand format » (`BAG-VALISE-L`) : **rattachée à la grande valise** `BAG-VALISE-GRANDE`, **0,30 m³** (v6.1 : 0,292 m³). Elle ne garde donc plus les 0,20 m³ de la valise classique.

  La correspondance est écrite dans `correspondance_identifiants_v6_2.csv`. Un contrôle signale la variante si elle est comptée avec la grande valise.
- **Bacs** : le bac standard (`CAR-BAC`, 0,10 m³) et le grand bac (`CAR-BAC-GRAND`, 0,20 m³) sont indépendants des cartons et des valises. Aucun des deux n'a de variante.
- **Variantes de taille.** Elles suivent leur parente en proportion de leur volume géométrique. Ce rapport est maintenant **borné entre 0,6 et 1,6** pour 106 variantes, car il produisait des valeurs absurdes : variante « grand format » du lit double à 8,2 m³, du métier à tisser à 8,2 m³. Les variantes ne doivent toujours pas être exposées aux devis avant validation.
- **Double comptage avec les cartons.** Le petit électroménager « à mettre en carton » porte un nouveau champ `inclus_dans_cartons`.
- **Grand miroir.** 0,3 m³ publié pour un objet de 0,022 m³, soit 13,6 fois plus : c'est le volume d'une caisse de protection. Valeur écartée ; 0,024 m³ retenu par les dimensions. À confirmer en revue.

---

## 3. Origine des volumes retenus (313 sous-catégories)

| Origine | Toutes | Prioritaires (228) |
| --- | ---: | ---: |
| **Valeur directement publiée par Démén'House** (dont 3 bornes de fourchette) | 28 | 27 |
| **Valeur directement publiée par un autre site identifié** | 8 | 8 |
| **Valeur publiée, site non identifié** (synthèse de recherche) | 28 | 26 |
| **Estimation par analogie** (sous-catégorie comparable) | 36 | 35 |
| **Estimation à partir des dimensions** (ratio de classe) | 206 | 125 |
| Convention validée (carton, bac, grand bac, valise, grande valise, très grande valise) | 6 | 6 |
| Exception documentée (objet non classé) | 1 | 1 |
| **Vérifiée par un professionnel** | **0** | **0** |

**Fiabilité** : 6 élevées (les conventions validées), 5 moyennes (valeur confirmée par une autre source identifiée), 301 provisoires et 1 exception.

**Rapports de classe** (volume de déménagement ÷ volume géométrique) :

| Classe | Rapport |
| --- | ---: |
| Appareils | 0,96 |
| Chaises | 1,02 |
| Objets plats ou souples | 1,09 |
| Meubles démontables | 1,53 |
| Sièges rembourrés | 1,66 |
| Meubles non démontables | 1,68 |

---

## 4. Inventaires types

**Contrôle de double comptage** (`verification_inventaires.csv`) : les 3 inventaires types sont **conformes**. Il n'y a :
- ni lit compté avec son matelas ou son sommier ;
- ni carton ;
- ni objet déjà compté dans les cartons ;
- ni variante ;
- ni ligne en double ;
- ni ensemble compté avec ses composants (salon de jardin et chaises de jardin, ensemble de valises et valises seules) ;
- ni bac ou valise assimilé à un carton.

Les bacs et les valises restent des objets distincts des cartons déclarés par le client.

**Comparaison avec la v5.** Elle ne porte que sur les objets qui ont une valeur v5, avec les mêmes objets et les mêmes quantités. Les autres lignes sont listées dans `couverture_inventaires.csv`.

| Logement type | Total v6.2 | Lignes comparées | v5 | v6.1 | **v6.2** | Écart v6.2 / v5 | Total sans Démén'House |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Studio / T1 | 15,6 m³ | 18 / 20 | 7,7 m³ | 15,7 m³ | **15,3 m³** | **+7,6 m³ (+99 %)** | 10,8 m³ |
| T3 familial | 32,3 m³ | 28 / 35 | 13,8 m³ | 29,7 m³ | **28,0 m³** | **+14,2 m³ (+103 %)** | 24,9 m³ |
| Maison 5 pièces | 75,3 m³ | 42 / 58 | 32,7 m³ | 70,3 m³ | **62,5 m³** | **+29,8 m³ (+91 %)** | 62,2 m³ |

Les totaux sont hors cartons. Avec les cartons à 0,10 m³, le T3 arrive à environ 36 m³ avec 40 cartons, et la maison à environ 83 m³ avec 80 cartons.

**Pourquoi la v5 est dépassée** (T3, +14,2 m³) :

| Cause | Écart |
| --- | ---: |
| Valeurs Démén'House | +6,8 m³ |
| Valeurs v5 inférieures au volume du meuble lui-même (exemple : lave-linge à 0,3 m³ pour un appareil de 0,53 m³), dont les valises (0,04 m³ en v5) | +4,8 m³ |
| Autres valeurs publiées | +2,3 m³ |
| Estimations | +0,3 m³ |

La hausse est donc justifiée en partie par des erreurs de la v5, et en partie par la convention de Démén'House, plus généreuse que celle des autres sites (environ 1,6 fois). Ce n'est pas un défaut à corriger, mais un choix à confirmer en revue professionnelle.

---

## 5. Anomalies restantes

`anomalies_restantes.csv` contient les **259 anomalies non résolues** (sur 299), classées par impact commercial.

| Impact | Nombre |
| --- | ---: |
| Significatif | 99 |
| Mineur | 160 |

**Les 99 à impact significatif**

| Type | Nombre | Traitement |
| --- | ---: | --- |
| Choix documentés entre sources divergentes | 28 | ne bloquent pas ; à confirmer en revue |
| Estimations sans référence professionnelle, pour des objets fréquents ou de plus de 1 m³ | 44 | provisoires, couvertes en partie par la revue des 40 |
| Volumes géométriques mesurés sur 1 ou 2 produits | 19 | n'influent pas sur le volume retenu quand une valeur publiée existe |
| Électroménager mesuré sur le marché nord-américain | 1 | même remarque |
| Sous-catégories à scinder (abri ou coffre de jardin ; piscine tubulaire ou spa) | 1 | — |
| Objets mesurés déployés, contournés par un volume de rangement | 6 | — |

**Résolues en v6.2** : incohérences de Démén'House, convention « lit complet », convention des armoires (comptées montées), conventions des bacs et des valises, réintégration des valeurs publiées.

**Aucune erreur majeure de classification connue** ne reste ouverte : les produits mal classés sont exclus depuis la v6.1.

---

## 6. Revue professionnelle des 40 catégories

`revue_40_categories.md` et `revue_40_categories.csv` présentent un tableau simple : sous-catégorie, volume proposé, question à poser, et les colonnes **Volume corrigé** et **Commentaire**, laissées vides.

Le document commence par **7 questions générales**. Elles portent sur :
- les meubles comptés montés ;
- le lit complet ;
- le carton à 0,10 m³ ;
- l'ordre de grandeur d'un T3 et d'une maison ;
- les objets surévalués ou sous-évalués ;
- les objets manquants.

La sélection privilégie les objets fréquents, les gros volumes, les grands écarts avec la v5 et les références contradictoires ou estimées. Les premières lignes :
1. lit double ;
2. canapé convertible ;
3. bibliothèque ;
4. canapé 3 places ;
5. bureau droit ;
6. canapé d'angle ;
7. lit 160 ;
8. armoire 2 portes ;
9. table basse ;
10. lit 180.

---

## 7. Tests automatiques

```bash
python3 -m unittest -v scripts/catalogue_v6/test_enrichir.py
```

**32 tests, tous réussis** (détail dans `resultats_tests_v6_2.txt`). Ils contrôlent :
- 313 sous-catégories : les 311 identifiants de la v5 inchangés, et les 2 créées en v6.2 ;
- les variantes des valises et leur correspondance ;
- un volume ou une exception pour chaque sous-catégorie ;
- le carton à 0,10 m³ partout ;
- la priorité à Démén'House et la cohérence entre ses deux publications ;
- des valeurs retenues réellement publiées, sans moyenne ;
- l'absence de valeur aberrante retenue ;
- le transat réintégré ;
- les conventions des bacs et des valises (0,10 / 0,20 / 0,30 m³), dans le catalogue et le CSV, non assimilées au carton ;
- le contrôle de double comptage des valises ;
- les inventaires types sans double comptage, et un contrôle qui détecte bien chaque cas de double comptage ;
- les variantes bornées ;
- la convention « lit complet » ;
- aucune valeur présentée comme vérifiée par un professionnel ;
- les estimations jamais présentées comme des mesures ;
- le volume géométrique v5 inchangé, et toutes les mesures conservées ;
- un état de résolution et un impact commercial pour chaque anomalie ;
- des exports cohérents avec les données ;
- la revue de 40 lignes, avec les colonnes à remplir vides ;
- l'historique v6.0 et v6.1 présent, et le journal des corrections renseigné ;
- la v5 non modifiée.

---

## 8. Bilan et points à traiter avant intégration

**Le catalogue v6.2 (313 sous-catégories) est figé comme première version candidate du catalogue commercial.** Il est cohérent dans ses ordres de grandeur, ne compte rien deux fois dans les inventaires types, ne contient aucune erreur de classification connue, et chaque valeur indique son origine.

**Points bloquants avant l'intégration dans le produit**

1. **Revue professionnelle non faite.** Les 40 catégories et les 7 questions générales doivent être passées en revue avec un déménageur. Tant que ce n'est pas fait, aucune valeur n'est vérifiée.
2. **Effet sur les prix des entreprises.** Les volumes v6.2 sont environ **deux fois plus élevés que ceux de la v5** pour les mêmes objets. Une entreprise qui a fixé son prix au m³ en se référant à ses propres volumes verrait ses devis presque doubler si elle garde le même prix. Il faut annoter ce changement de base aux entreprises, et éventuellement leur proposer de revoir leur prix au m³. C'est une décision commerciale.
3. **Règles à prévoir dans le moteur de devis**, non faites ici et à autoriser :
   - application de la correspondance entre les 134 anciens identifiants et les nouveaux (préparée dans `correspondance_identifiants_v6_2.csv`) ;
   - migration pour importer le catalogue ;
   - ne pas exposer les variantes de taille ;
   - ne pas ajouter le volume des objets `inclus_dans_cartons` quand le client déclare des cartons ;
   - traiter les cartons visibles dans la vidéo, pour qu'ils ne s'ajoutent pas aux cartons déclarés : la pièce de test « chambre encombrée » en contient un.
4. **Sources à relire.** Les valeurs publiées ont été relevées dans des extraits de moteur de recherche, sans ouvrir les pages, que le réseau bloquait. Plus de la moitié ne sont pas attribuées à un site précis.

**Points non bloquants**
- 206 sous-catégories estimées à partir des dimensions, surtout des objets rares ;
- volumes géométriques sur peu de produits ;
- électroménager mesuré sur le marché nord-américain ;
- deux sous-catégories à scinder.

---

## 9. Fichiers (`data/catalogue-v6/`)

| Fichier | Contenu |
| --- | --- |
| `catalogue_volumes_v6.csv` / `.json` | catalogue candidat v6.2 : 313 sous-catégories, volumes v5, v6.0, v6.1, v6.2, origine, fiabilité, statut |
| `anomalies.csv` / `anomalies_restantes.csv` | toutes les anomalies / les anomalies non résolues, avec leur impact commercial |
| `mesures_individuelles.csv` | 13 096 mesures et estimations, avec leur statut |
| `revue_40_categories.md` / `.csv` | support de la revue professionnelle |
| `corrections_v6_2.csv`, `comparatif_versions.csv` | corrections (dont les créations et les variantes de valise) et comparaison des versions |
| `correspondance_identifiants_v6_2.csv` | règles de correspondance : 134 anciens identifiants du moteur, 204 variantes, 2 nouvelles sous-catégories |
| `couverture_inventaires.csv`, `verification_inventaires.csv`, `decomposition_ecart_v5.csv` | inventaires types |
| `resultats_tests_v6_2.txt` | résultat des tests |
| `CHANGELOG.md`, `historique/v6.0/`, `historique/v6.1/` | historique et données des versions précédentes |
