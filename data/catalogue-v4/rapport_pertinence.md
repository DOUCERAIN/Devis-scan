# Pertinence pour le déménagement et couverture métier — catalogue Devis Scan v4

## Classement de pertinence

Chaque famille et chaque sous-catégorie reçoit un niveau (colonnes `pertinence` et `niveau_pertinence`). **Aucune référence n'est supprimée.** Le moteur IA pourra privilégier les niveaux 1 et 2 dans la liste des candidats.

| Niveau | Définition | Sous-catégories |
| --- | --- | ---: |
| 1 — courant | présent dans la plupart des logements | 87 |
| 2 — complémentaire | fréquent sans être systématique (selon le logement, la famille, les loisirs) | 139 |
| 3 — spécifique ou exceptionnel | rare, volumineux ou à manutention particulière | 66 |
| 4 — peu pertinent pour un inventaire classique | objet de collection, professionnel ou historique | 19 |

**Il s'agit d'une appréciation qualitative de Devis Scan, pas d'une statistique observée** : aucune donnée de fréquence réelle des objets dans les déménagements n'était disponible. Le classement est à recalibrer avec les inventaires des déménageurs pilotes (`scripts/catalogue_v4/pertinence.py`).

### Par famille (niveau par défaut)

| Famille | Niveau | Sous-catégories par niveau (1 / 2 / 3 / 4) |
| --- | --- | --- |
| ARM — Armoires et penderies | 1 — courant | 5 / 7 / 0 / 0 |
| CAN — Canapés | 1 — courant | 5 / 6 / 0 / 0 |
| FAU — Fauteuils et assises individuelles | 1 — courant | 1 / 3 / 0 / 0 |
| POU — Poufs et repose-pieds | 2 — complémentaire | 0 / 2 / 0 / 0 |
| LIT — Lits et têtes de lit | 1 — courant | 6 / 4 / 1 / 0 |
| MAT — Matelas et sommiers | 1 — courant | 6 / 0 / 0 / 0 |
| CHV — Tables de chevet | 1 — courant | 1 / 0 / 0 / 0 |
| COM — Commodes et chiffonniers | 1 — courant | 5 / 2 / 0 / 0 |
| TAB — Tables | 1 — courant | 6 / 4 / 1 / 0 |
| CHA — Chaises, tabourets et bancs | 1 — courant | 2 / 3 / 0 / 0 |
| RAN — Rangements du séjour (buffets, bibliothèques, vitrines, meubles TV) | 1 — courant | 6 / 4 / 0 / 0 |
| ETA — Étagères et rayonnages | 1 — courant | 3 / 2 / 0 / 0 |
| ENT — Meubles d'entrée | 2 — complémentaire | 1 / 2 / 0 / 0 |
| CUI — Mobilier de cuisine | 1 — courant | 3 / 1 / 1 / 0 |
| ELM — Gros électroménager | 1 — courant | 10 / 5 / 0 / 2 |
| PEM — Petit électroménager et appareils mobiles | 1 — courant | 3 / 0 / 0 / 0 |
| BUR — Mobilier de bureau | 1 — courant | 2 / 4 / 3 / 0 |
| INF — Informatique (ordinateurs, imprimantes) | 1 — courant | 1 / 1 / 0 / 0 |
| SDB — Meubles de salle de bain | 1 — courant | 3 / 2 / 2 / 0 |
| ENF — Mobilier et équipements pour enfants | 2 — complémentaire | 1 / 8 / 3 / 0 |
| JAR — Mobilier et équipements de jardin | 2 — complémentaire | 2 / 10 / 2 / 0 |
| SPO — Équipements sportifs et de loisirs | 2 — complémentaire | 0 / 10 / 4 / 0 |
| VEL — Vélos et engins à roues | 2 — complémentaire | 1 / 3 / 1 / 1 |
| MUS — Instruments de musique | 3 — spécifique ou exceptionnel | 0 / 5 / 7 / 0 |
| DEC — Décoration volumineuse (horloges, paravents) | 2 — complémentaire | 0 / 2 / 0 / 0 |
| BRI — Bricolage, atelier et garage | 2 — complémentaire | 0 / 5 / 1 / 0 |
| BAG — Bagages, malles et coffres | 2 — complémentaire | 0 / 4 / 0 / 0 |
| DIV — Objets particuliers (coffres-forts, aquariums, horloges…) | 2 — complémentaire | 0 / 3 / 1 / 0 |
| ANC — Mobilier ancien et patrimonial | 3 — spécifique ou exceptionnel | 0 / 8 / 15 / 0 |
| CAR — Cartons et contenants | 1 — courant | 3 / 1 / 0 / 0 |
| TEL — Téléviseurs et écrans | 1 — courant | 3 / 2 / 1 / 0 |
| AUD — Audio, radios et phonographes | 2 — complémentaire | 0 / 2 / 2 / 1 |
| LUM — Luminaires | 1 — courant | 2 / 2 / 0 / 0 |
| TAP — Tapis | 1 — courant | 4 / 0 / 0 / 0 |
| MIR — Miroirs, tableaux et cadres | 1 — courant | 2 / 1 / 1 / 0 |
| PLA — Plantes et végétaux | 2 — complémentaire | 0 / 2 / 0 / 0 |
| ANI — Animaux (niches, cages, aquariums) | 2 — complémentaire | 0 / 6 / 0 / 0 |
| PRO — Mobilier professionnel et stockage | 4 — peu pertinent pour un inventaire classique | 0 / 0 / 0 / 6 |
| RES — Restauration, commerce et distribution | 4 — peu pertinent pour un inventaire classique | 0 / 0 / 0 / 5 |
| MED — Médical et aide à la personne | 3 — spécifique ou exceptionnel | 0 / 4 / 3 / 0 |
| COU — Couture, artisanat et métiers | 3 — spécifique ou exceptionnel | 0 / 2 / 4 / 0 |
| MAC — Machines de bureau et appareils anciens | 4 — peu pertinent pour un inventaire classique | 0 / 0 / 0 / 4 |
| ART — Objets d'art et décoration monumentale | 3 — spécifique ou exceptionnel | 0 / 0 / 3 / 0 |
| JEU — Jeux d'intérieur (billard, flipper, baby-foot) | 3 — spécifique ou exceptionnel | 0 / 2 / 5 / 0 |
| CHF — Chauffage, climatisation et ventilation | 2 — complémentaire | 0 / 4 / 2 / 0 |
| MOT — Deux-roues motorisés et engins | 3 — spécifique ou exceptionnel | 0 / 1 / 3 / 0 |

## Couverture par niveau de pertinence

| Niveau | Sous-catégories | Dimensions complètes | dont fiables (moyenne ou élevée) | Dimensions partielles seulement | Aucune donnée |
| --- | ---: | ---: | ---: | ---: | ---: |
| 1 — courant | 87 | 77 (89 %) | 61 (70 %) | 5 | 5 |
| 2 — complémentaire | 139 | 89 (64 %) | 54 (39 %) | 4 | 46 |
| 3 — spécifique ou exceptionnel | 66 | 48 (73 %) | 34 (52 %) | 0 | 18 |
| 4 — peu pertinent pour un inventaire classique | 19 | 14 (74 %) | 7 (37 %) | 0 | 5 |

## Indicateur de couverture métier pondéré (appréciation qualitative)

Poids attribués par Devis Scan selon le niveau : courant 4, complémentaire 2, spécifique 1, peu pertinent 0. **Ce n'est pas une fréquence mesurée** : l'indicateur dit seulement que l'absence d'un objet courant pèse quatre fois plus que celle d'un objet exceptionnel.

- Couverture pondérée, sous-catégories à dimensions complètes : **77,2 %**
- Couverture pondérée, sous-catégories complètes et fiables : **55,8 %**
- Références réellement exploitables par le moteur IA (niveaux 1 à 3, dimensions complètes, ≥ 5 modèles et ≥ 2 sources indépendantes) : **149** sur 311, dont 61 courantes et 54 complémentaires.

### Règle des objets anciens (v4)

Pour ne pas compenser l'absence d'un objet courant par du mobilier ancien ou des objets de collection, **un objet de musée ou de Wikidata daté d'avant 1950 (ou non daté) n'entre plus dans les statistiques d'une sous-catégorie actuelle** (électroménager, literie, sièges, tables, rangements, etc.). Il reste dans la base, avec le motif « objet ancien : non représentatif ». Il continue de documenter le mobilier ancien (`ANC-*`), les sous-catégories de niveau 3 ou 4, et les objets dont la forme ne dépend pas de l'époque (tapis, horloges, pianos, miroirs, malles, coffres-forts…).
Conséquence : 447 observations retirées des statistiques. Trois sous-catégories prioritaires que la v3 comptait comme documentées ne l'étaient que par des objets anciens et redeviennent non documentées : lit bébé (`LIT-BEBE`), lave-vaisselle (`ELM-LV`), établi (`BRI-ETABLI`). La cuisinière (`ELM-CUISINIERE`), dans le même cas, est désormais documentée par ENERGY STAR (95 modèles).

## Objets courants : état par groupe

### Armoires et penderies — 9 / 12 sous-catégories à dimensions complètes

| Sous-catégorie | Pertinence | État | Volume médian (m³) |
| --- | --- | --- | ---: |
| `ARM-1P` Armoire 1 porte | 1 | 3 modèles, faible | 0,507 |
| `ARM-2P` Armoire 2 portes | 1 | 12 modèles, moyenne | 1,021 |
| `ARM-3P` Armoire 3 portes | 1 | 8 modèles, moyenne | 1,205 |
| `ARM-4P` Armoire 4 portes | 2 | 3 modèles, faible | 2,173 |
| `ARM-5P+` Armoire 5 portes et plus | 2 | 3 modèles, faible | 3,775 |
| `ARM-COUL` Armoire à portes coulissantes | 1 | 7 modèles, moyenne | 2,878 |
| `ARM-ANG` Armoire d'angle | 2 | 2 modèles, faible | 1,173 |
| `ARM-NC` Armoire (nombre de portes non précisé) | 1 | 28 modèles, moyenne | 0,567 |
| `ARM-BAS` Armoire basse | 2 | **aucune donnée** | — |
| `ARM-PORT` Portant à vêtements | 2 | 14 modèles, moyenne | 0,654 |
| `ARM-DRESS` Dressing (module ou ensemble) | 2 | **aucune donnée** | — |
| `ARM-TISSU` Armoire en tissu ou penderie démontable | 2 | **aucune donnée** | — |

### Canapés et fauteuils — 13 / 17 sous-catégories à dimensions complètes

| Sous-catégorie | Pertinence | État | Volume médian (m³) |
| --- | --- | --- | ---: |
| `CAN-2P` Canapé 2 places | 1 | 80 modèles, élevée — 5 % de modèles de collection | 1,317 |
| `CAN-3P` Canapé 3 places | 1 | 48 modèles, élevée | 1,459 |
| `CAN-4P` Canapé 4 places | 2 | **aucune donnée** | — |
| `CAN-5P` Canapé 5 places et plus | 2 | **aucune donnée** | — |
| `CAN-ANG` Canapé d'angle | 1 | 18 modèles, élevée | 2,399 |
| `CAN-PANO` Canapé panoramique | 2 | **aucune donnée** | — |
| `CAN-CONV` Canapé convertible ou canapé-lit | 1 | 21 modèles, élevée — 24 % de modèles de collection | 1,224 |
| `CAN-MOD` Canapé modulable | 2 | **aucune donnée** | — |
| `CAN-RELAX` Canapé relax | 2 | 2 modèles, faible | 2,320 |
| `CAN-MERID` Méridienne ou banquette-lit | 2 | 17 modèles, élevée — 41 % de modèles de collection | 0,903 |
| `CAN-NC` Canapé (nombre de places non précisé) | 1 | 101 modèles, élevée — 18 % de modèles de collection | 1,629 |
| `FAU-STD` Fauteuil | 1 | 192 modèles, élevée — 35 % de modèles de collection | 0,493 |
| `FAU-RELAX` Fauteuil relax | 2 | 43 modèles, élevée | 0,806 |
| `FAU-PIVOT` Fauteuil pivotant | 2 | 21 modèles, élevée | 0,487 |
| `FAU-BASCULE` Rocking-chair | 2 | 7 modèles, moyenne — 57 % de modèles de collection | 0,881 |
| `POU-STD` Pouf ou repose-pieds | 2 | 96 modèles, moyenne — 3 % de modèles de collection | 0,220 |
| `FAU-POIRE` Pouf poire | 2 | 2 modèles, faible | 1,529 |

### Lits et literie — 16 / 19 sous-catégories à dimensions complètes

| Sous-catégorie | Pertinence | État | Volume médian (m³) |
| --- | --- | --- | ---: |
| `LIT-SIMPLE` Lit simple (90 cm) | 1 | 17 modèles, moyenne | 0,849 |
| `LIT-DOUBLE` Lit double (135 à 140 cm) | 1 | 18 modèles, moyenne | 1,023 |
| `LIT-QUEEN` Lit queen size (150 à 160 cm) | 1 | 39 modèles, moyenne | 2,930 |
| `LIT-KING` Lit king size (180 cm et plus) | 1 | 34 modèles, moyenne | 3,213 |
| `LIT-NC` Lit (taille non précisée) | 1 | 50 modèles, élevée | 4,383 |
| `LIT-COFFRE` Lit coffre ou lit à rangements | 1 | 6 modèles, moyenne | 4,364 |
| `LIT-SUPERP` Lit superposé ou mezzanine | 2 | 5 modèles, moyenne | 3,465 |
| `LIT-ESCAM` Lit escamotable | 2 | **aucune donnée** | — |
| `LIT-TETE` Tête de lit | 2 | 47 modèles, élevée | 0,216 |
| `LIT-GIGOGNE` Lit gigogne | 2 | 1 modèles, faible | 2,069 |
| `LIT-BEBE` Lit bébé | 1 | **aucune donnée** | — |
| `LIT-ENFANT` Lit enfant (junior) | 2 | **aucune donnée** | — |
| `MAT-90` Matelas 80 à 100 cm | 1 | 10 modèles, moyenne | 0,370 |
| `MAT-140` Matelas 135 à 140 cm | 1 | 7 modèles, moyenne | 0,644 |
| `MAT-160` Matelas 150 à 160 cm | 1 | 5 modèles, moyenne | 0,736 |
| `MAT-180` Matelas 180 cm et plus | 1 | 5 modèles, moyenne | 0,900 |
| `MAT-NC` Matelas (taille non précisée) | 1 | 12 modèles, moyenne | 0,554 |
| `SOM-STD` Sommier | 1 | 13 modèles, faible | 0,672 |
| `CHV-STD` Table de chevet | 1 | 77 modèles, élevée — 1 % de modèles de collection | 0,101 |

### Commodes et rangements — 15 / 19 sous-catégories à dimensions complètes

| Sous-catégorie | Pertinence | État | Volume médian (m³) |
| --- | --- | --- | ---: |
| `COM-3T` Commode 3 tiroirs | 1 | 17 modèles, moyenne | 0,278 |
| `COM-4T` Commode 4 tiroirs | 1 | 13 modèles, moyenne | 0,286 |
| `COM-5T` Commode 5 tiroirs | 1 | 6 modèles, moyenne | 0,412 |
| `COM-LARGE` Commode large (6 tiroirs et plus) | 1 | 9 modèles, moyenne | 0,576 |
| `COM-NC` Commode (nombre de tiroirs non précisé) | 1 | 41 modèles, élevée — 5 % de modèles de collection | 0,475 |
| `COM-SEMAINIER` Chiffonnier ou semainier (meuble haut à tiroirs) | 2 | **aucune donnée** | — |
| `COM-COIFF` Coiffeuse | 2 | 2 modèles, faible | 0,574 |
| `RAN-BUFFET` Buffet bas ou enfilade | 1 | 52 modèles, élevée — 4 % de modèles de collection | 0,520 |
| `RAN-BUFFET-HAUT` Buffet haut ou vaisselier | 1 | 1 modèles, faible | 0,521 |
| `RAN-VITRINE` Vitrine | 2 | 15 modèles, élevée | 0,527 |
| `RAN-ANGLE` Meuble d'angle (encoignure) | 2 | **aucune donnée** | — |
| `ETA-NC` Étagère sur pieds | 1 | 42 modèles, moyenne — 14 % de modèles de collection | 0,208 |
| `ETA-METAL` Étagère métallique ou rayonnage | 1 | 16 modèles, moyenne | 0,458 |
| `ETA-MURALE` Étagère murale | 2 | 12 modèles, moyenne | 0,032 |
| `ETA-ECHELLE` Étagère échelle | 2 | **aucune donnée** | — |
| `RAN-BIB-CUBE` Étagère cube | 1 | 11 modèles, moyenne | 0,180 |
| `ENT-CHAUSS` Meuble à chaussures | 1 | 40 modèles, moyenne | 0,250 |
| `ENT-MEUBLE` Meuble d'entrée | 2 | **aucune donnée** | — |
| `ENT-PORTEMANTEAU` Portemanteau sur pied ou vestiaire | 2 | 11 modèles, moyenne | 0,409 |

### Tables et chaises — 15 / 15 sous-catégories à dimensions complètes

| Sous-catégorie | Pertinence | État | Volume médian (m³) |
| --- | --- | --- | ---: |
| `TAB-4` Table à manger 2 à 4 personnes | 1 | 2 modèles, faible | 0,671 |
| `TAB-6` Table à manger 6 personnes | 1 | 1 modèles, faible | 1,129 |
| `TAB-8+` Table à manger 8 personnes et plus | 2 | 5 modèles, moyenne | 1,433 |
| `TAB-REPAS-NC` Table à manger (capacité non précisée) | 1 | 112 modèles, élevée — 35 % de modèles de collection | 1,043 |
| `TAB-RONDE` Table à manger ronde | 1 | 6 modèles, moyenne | 0,437 |
| `TAB-BASSE` Table basse | 1 | 164 modèles, élevée — 6 % de modèles de collection | 0,289 |
| `TAB-APPOINT` Bout de canapé ou table d'appoint | 1 | 129 modèles, élevée — 5 % de modèles de collection | 0,122 |
| `TAB-CONSOLE` Console | 2 | 37 modèles, élevée — 5 % de modèles de collection | 0,369 |
| `TAB-HAUTE` Table haute ou mange-debout | 2 | 4 modèles, faible | 0,653 |
| `TAB-PLIANTE` Table pliante | 2 | 5 modèles, moyenne | 0,542 |
| `CHA-REPAS` Chaise de salle à manger | 1 | 224 modèles, élevée — 66 % de modèles de collection | 0,243 |
| `CHA-BAR` Tabouret de bar | 1 | 84 modèles, élevée — 4 % de modèles de collection | 0,264 |
| `CHA-TABOURET` Tabouret bas | 2 | 47 modèles, élevée — 87 % de modèles de collection | 0,066 |
| `CHA-PLIANTE` Chaise pliante | 2 | 5 modèles, moyenne — 100 % de modèles de collection | 0,175 |
| `CHA-BANC` Banc | 2 | 54 modèles, moyenne — 15 % de modèles de collection | 0,235 |

### Bibliothèques — 4 / 4 sous-catégories à dimensions complètes

| Sous-catégorie | Pertinence | État | Volume médian (m³) |
| --- | --- | --- | ---: |
| `RAN-BIB-HAUTE` Bibliothèque haute | 1 | 4 modèles, faible | 0,442 |
| `RAN-BIB-BASSE` Bibliothèque basse | 1 | 9 modèles, moyenne | 0,237 |
| `RAN-BIB-NC` Bibliothèque (hauteur non précisée) | 1 | 63 modèles, moyenne — 8 % de modèles de collection | 0,368 |
| `RAN-BIB-FERMEE` Bibliothèque fermée ou vitrée | 2 | 1 modèles, faible | 0,612 |

### Meubles TV et téléviseurs — 3 / 5 sous-catégories à dimensions complètes

| Sous-catégorie | Pertinence | État | Volume médian (m³) |
| --- | --- | --- | ---: |
| `RAN-MEUBLE-TV` Meuble TV | 1 | 54 modèles, élevée | 0,325 |
| `INF-TV-32` Téléviseur jusqu'à 39 pouces | 1 | 1 modèles, faible | 0,054 |
| `INF-TV-43` Téléviseur 40 à 49 pouces | 1 | 3 modèles, faible | 0,102 |
| `INF-TV-55` Téléviseur 50 à 65 pouces | 1 | **aucune donnée** | — |
| `INF-TV-75` Téléviseur 70 pouces et plus | 2 | **aucune donnée** | — |

### Bureaux — 7 / 9 sous-catégories à dimensions complètes

| Sous-catégorie | Pertinence | État | Volume médian (m³) |
| --- | --- | --- | ---: |
| `BUR-DROIT` Bureau droit | 1 | 105 modèles, élevée — 21 % de modèles de collection | 0,608 |
| `BUR-ANGLE` Bureau d'angle | 2 | 7 modèles, moyenne | 1,332 |
| `BUR-ASSIS` Bureau assis-debout | 2 | 2 modèles, faible | 0,435 |
| `FAU-BUR` Fauteuil ou chaise de bureau | 1 | 76 modèles, élevée — 3 % de modèles de collection | 0,446 |
| `BUR-CLASSEUR` Armoire ou meuble de classement | 2 | 11 modèles, moyenne — 9 % de modèles de collection | 0,350 |
| `BUR-CAISSON` Caisson de bureau | 2 | **aucune donnée** | — |
| `BUR-ENFANT` Bureau enfant | 2 | **aucune donnée** | — |
| `INF-ORDI` Ordinateur fixe, écran ou poste de travail | 1 | 2 modèles, faible — 100 % de modèles de collection | 0,148 |
| `INF-IMPRIMANTE` Imprimante ou multifonction | 2 | 1 modèles, faible — 100 % de modèles de collection | 0,013 |

### Réfrigérateurs et congélateurs — 1 / 9 sous-catégories à dimensions complètes

| Sous-catégorie | Pertinence | État | Volume médian (m³) |
| --- | --- | --- | ---: |
| `ELM-REF` Réfrigérateur | 1 | 2 modèles, faible — 100 % de modèles de collection | 0,901 |
| `ELM-REF-COMBI` Réfrigérateur combiné (congélateur en bas) | 1 | partielle (588 modèles : hauteur 177 cm, largeur 75 cm) | — |
| `ELM-REF-US` Réfrigérateur américain | 2 | partielle (91 modèles : hauteur 178 cm, largeur 91 cm) | — |
| `ELM-REF-1P` Réfrigérateur une porte | 1 | partielle (45 modèles : hauteur 170 cm, largeur 60 cm) | — |
| `ELM-REF-TOP` Réfrigérateur table top ou mini-réfrigérateur | 1 | partielle (1430 modèles : hauteur 84 cm, largeur 48 cm) | — |
| `ELM-REF-MULTI` Réfrigérateur multiportes | 2 | **aucune donnée** | — |
| `ELM-CONG` Congélateur | 1 | partielle (1 modèles : hauteur 87 cm, largeur 59 cm) | — |
| `ELM-CONG-COFFRE` Congélateur coffre | 2 | partielle (1 modèles : hauteur 85 cm, largeur 55 cm) | — |
| `ELM-CAVE` Cave à vin | 2 | partielle (148 modèles : hauteur 87 cm, largeur 60 cm) | — |

### Lave-linge et sèche-linge — 3 / 3 sous-catégories à dimensions complètes

| Sous-catégorie | Pertinence | État | Volume médian (m³) |
| --- | --- | --- | ---: |
| `ELM-LL` Lave-linge | 1 | 108 modèles, élevée | 0,526 |
| `ELM-SL` Sèche-linge | 1 | 491 modèles, élevée | 0,521 |
| `ELM-LAVANTE-SECHANTE` Lave-linge séchant | 2 | 8 modèles, moyenne | 0,686 |

### Lave-vaisselle — 0 / 1 sous-catégories à dimensions complètes

| Sous-catégorie | Pertinence | État | Volume médian (m³) |
| --- | --- | --- | ---: |
| `ELM-LV` Lave-vaisselle | 1 | partielle (622 modèles : largeur 60 cm, profondeur 57 cm) | — |

### Fours et cuisinières — 3 / 3 sous-catégories à dimensions complètes

| Sous-catégorie | Pertinence | État | Volume médian (m³) |
| --- | --- | --- | ---: |
| `ELM-FOUR` Four | 1 | 1 modèles, faible — 100 % de modèles de collection | 0,383 |
| `ELM-CUISINIERE` Cuisinière (four et plaques) | 1 | 95 modèles, élevée | 0,476 |
| `ELM-MO` Micro-ondes ou mini-four | 1 | 6 modèles, moyenne — 17 % de modèles de collection | 0,053 |

### Mobilier de cuisine — 3 / 4 sous-catégories à dimensions complètes

| Sous-catégorie | Pertinence | État | Volume médian (m³) |
| --- | --- | --- | ---: |
| `CUI-BUFFET` Buffet ou colonne de cuisine | 1 | 4 modèles, faible — 100 % de modèles de collection | 0,725 |
| `CUI-DESSERTE` Desserte de cuisine | 1 | 29 modèles, élevée | 0,249 |
| `CUI-ILOT` Îlot de cuisine | 2 | 1 modèles, faible | 0,483 |
| `CUI-ETAGERE` Étagère de cuisine ou micro-ondes | 1 | **aucune donnée** | — |

### Mobilier de salle de bain — 3 / 5 sous-catégories à dimensions complètes

| Sous-catégorie | Pertinence | État | Volume médian (m³) |
| --- | --- | --- | ---: |
| `SDB-VASQUE` Meuble sous-vasque | 1 | 2 modèles, faible | 0,170 |
| `SDB-COLONNE` Colonne de salle de bain | 1 | **aucune donnée** | — |
| `SDB-ARMOIRE` Armoire de toilette ou meuble suspendu | 1 | 4 modèles, faible — 50 % de modèles de collection | 0,117 |
| `SDB-ETAGERE` Étagère de salle de bain | 2 | **aucune donnée** | — |
| `SDB-PANIER` Panier à linge | 2 | 12 modèles, moyenne | 0,087 |

### Mobilier de jardin — 8 / 11 sous-catégories à dimensions complètes

| Sous-catégorie | Pertinence | État | Volume médian (m³) |
| --- | --- | --- | ---: |
| `JAR-TABLE` Table de jardin | 1 | 1 modèles, faible | 1,149 |
| `JAR-CHAISE` Chaise ou fauteuil de jardin | 1 | 8 modèles, moyenne | 0,542 |
| `JAR-SALON` Salon de jardin (ensemble) | 2 | **aucune donnée** | — |
| `JAR-TRANSAT` Bain de soleil ou transat | 2 | 3 modèles, faible — 33 % de modèles de collection | 0,759 |
| `JAR-BANC` Banc de jardin | 2 | **aucune donnée** | — |
| `JAR-PARASOL` Parasol | 2 | 11 modèles, moyenne | 5,597 |
| `JAR-BARBECUE` Barbecue ou plancha | 2 | 7 modèles, moyenne — 14 % de modèles de collection | 0,406 |
| `JAR-ABRI` Abri, coffre ou serre de jardin | 2 | 7 modèles, faible | 27,325 |
| `JAR-JARDINIERE` Jardinière ou grand pot | 2 | 42 modèles, moyenne — 21 % de modèles de collection | 0,017 |
| `JAR-BALANCELLE` Balancelle, hamac ou fauteuil suspendu | 2 | 3 modèles, faible | 2,861 |
| `JAR-TONDEUSE` Tondeuse et matériel motorisé de jardin | 2 | **aucune donnée** | — |

## Sous-catégories prioritaires encore insuffisamment documentées : 39 sur 171

| Sous-catégorie | Pertinence | État | Pourquoi |
| --- | --- | --- | --- |
| `PRO-ARMOIRE-RIDEAU` Armoire à rideaux ou à portes battantes de bureau | 4 | **aucune donnée** | pas de donnée réutilisable trouvée dans les sources accessibles |
| `ARM-BAS` Armoire basse | 2 | **aucune donnée** | pas de donnée réutilisable trouvée dans les sources accessibles |
| `ARM-DRESS` Dressing (module ou ensemble) | 2 | **aucune donnée** | pas de donnée réutilisable trouvée dans les sources accessibles |
| `CAN-PANO` Canapé panoramique | 2 | **aucune donnée** | pas de donnée réutilisable trouvée dans les sources accessibles |
| `CAN-4P` Canapé 4 places | 2 | **aucune donnée** | pas de donnée réutilisable trouvée dans les sources accessibles |
| `LIT-BEBE` Lit bébé | 1 | **aucune donnée** | seuls des objets anciens existent dans les sources (exclus par la règle v4) |
| `ENT-MEUBLE` Meuble d'entrée | 2 | **aucune donnée** | pas de donnée réutilisable trouvée dans les sources accessibles |
| `CUI-ETAGERE` Étagère de cuisine ou micro-ondes | 1 | **aucune donnée** | pas de donnée réutilisable trouvée dans les sources accessibles |
| `ELM-REF-US` Réfrigérateur américain | 2 | partielle (91 modèles : hauteur 178 cm, largeur 91 cm) | ENERGY STAR publie hauteur et largeur, pas la profondeur ; EPREL publie les 3 dimensions mais exige une clé |
| `ELM-REF-COMBI` Réfrigérateur combiné (congélateur en bas) | 1 | partielle (588 modèles : hauteur 177 cm, largeur 75 cm) | ENERGY STAR publie hauteur et largeur, pas la profondeur ; EPREL publie les 3 dimensions mais exige une clé |
| `ELM-REF-TOP` Réfrigérateur table top ou mini-réfrigérateur | 1 | partielle (1430 modèles : hauteur 84 cm, largeur 48 cm) | ENERGY STAR publie hauteur et largeur, pas la profondeur ; EPREL publie les 3 dimensions mais exige une clé |
| `ELM-CONG` Congélateur | 1 | partielle (1 modèles : hauteur 87 cm, largeur 59 cm) | ENERGY STAR publie hauteur et largeur, pas la profondeur ; EPREL publie les 3 dimensions mais exige une clé |
| `ELM-CAVE` Cave à vin | 2 | partielle (148 modèles : hauteur 87 cm, largeur 60 cm) | ENERGY STAR publie hauteur et largeur, pas la profondeur ; EPREL publie les 3 dimensions mais exige une clé |
| `ELM-LV` Lave-vaisselle | 1 | partielle (622 modèles : largeur 60 cm, profondeur 57 cm) | ENERGY STAR publie largeur et profondeur, pas la hauteur ; EPREL publie les 3 dimensions mais exige une clé |
| `BUR-ENFANT` Bureau enfant | 2 | **aucune donnée** | pas de donnée réutilisable trouvée dans les sources accessibles |
| `BUR-CAISSON` Caisson de bureau | 2 | **aucune donnée** | pas de donnée réutilisable trouvée dans les sources accessibles |
| `INF-TV-75` Téléviseur 70 pouces et plus | 2 | **aucune donnée** | ENERGY STAR ne publie que la diagonale des téléviseurs ; EPREL publie les dimensions (clé nécessaire) ; ABO n'a que quelques téléviseurs Eono |
| `INF-TV-55` Téléviseur 50 à 65 pouces | 1 | **aucune donnée** | ENERGY STAR ne publie que la diagonale des téléviseurs ; EPREL publie les dimensions (clé nécessaire) ; ABO n'a que quelques téléviseurs Eono |
| `SDB-COLONNE` Colonne de salle de bain | 1 | **aucune donnée** | pas de donnée réutilisable trouvée dans les sources accessibles |
| `SDB-ETAGERE` Étagère de salle de bain | 2 | **aucune donnée** | pas de donnée réutilisable trouvée dans les sources accessibles |
| `ENF-COFFRE` Coffre à jouets | 2 | **aucune donnée** | pas de donnée réutilisable trouvée dans les sources accessibles |
| `ENF-POUSSETTE` Poussette | 2 | **aucune donnée** | pas de donnée réutilisable trouvée dans les sources accessibles |
| `JAR-SALON` Salon de jardin (ensemble) | 2 | **aucune donnée** | pas de donnée réutilisable trouvée dans les sources accessibles |
| `JAR-TONDEUSE` Tondeuse et matériel motorisé de jardin | 2 | **aucune donnée** | pas de donnée réutilisable trouvée dans les sources accessibles |
| `SPO-TAPIS-COURSE` Tapis de course | 2 | **aucune donnée** | pas de donnée réutilisable trouvée dans les sources accessibles |
| `SPO-RAMEUR` Rameur | 2 | **aucune donnée** | pas de donnée réutilisable trouvée dans les sources accessibles |
| `SPO-PINGPONG` Table de ping-pong | 2 | **aucune donnée** | pas de donnée réutilisable trouvée dans les sources accessibles |
| `SPO-BILLARD` Billard | 3 | **aucune donnée** | pas de donnée réutilisable trouvée dans les sources accessibles |
| `SPO-SURF` Planche de surf ou paddle | 2 | **aucune donnée** | pas de donnée réutilisable trouvée dans les sources accessibles |
| `SPO-SKI` Skis, snowboard et équipement de glisse | 2 | **aucune donnée** | pas de donnée réutilisable trouvée dans les sources accessibles |
| `VEL-TROTTINETTE` Trottinette | 2 | **aucune donnée** | pas de donnée réutilisable trouvée dans les sources accessibles |
| `MUS-PIANO-NUM` Piano numérique ou clavier | 2 | **aucune donnée** | pas de donnée réutilisable trouvée dans les sources accessibles |
| `DEC-PLANTE` Grande plante (artificielle ou en pot) | 2 | **aucune donnée** | pas de donnée réutilisable trouvée dans les sources accessibles |
| `BRI-ETABLI` Établi | 2 | **aucune donnée** | seuls des objets anciens existent dans les sources (exclus par la règle v4) |
| `BRI-SERVANTE` Servante ou coffre à outils roulant | 2 | **aucune donnée** | pas de donnée réutilisable trouvée dans les sources accessibles |
| `BRI-ARMOIRE-GARAGE` Armoire de garage ou d'atelier | 2 | **aucune donnée** | pas de donnée réutilisable trouvée dans les sources accessibles |
| `DIV-AQUARIUM` Aquarium ou terrarium | 2 | **aucune donnée** | pas de donnée réutilisable trouvée dans les sources accessibles |
| `CAR-SAC` Sac, ballot ou housse remplis | 1 | **aucune donnée** | non mesurable par nature (volume propre à chaque objet) |
| `DIV-AUTRE` Objet non classé | 2 | **aucune donnée** | non mesurable par nature (volume propre à chaque objet) |

Les deux sous-catégories non mesurables par nature (`DIV-AUTRE`, `CAR-SAC`) mises à part, la couverture serait de 132 / 169 (78,1 %), toujours sous l'objectif.
