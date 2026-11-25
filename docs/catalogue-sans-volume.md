# Références du catalogue sans volume de déménagement

État au 25/11/2026 : **52 références sur 134** n'ont pas de volume de référence (54 avant cette vérification).

## Traitement actuel (vérifié par des tests)

1. L'IA reconnaît l'objet et le rattache à la référence (ex. « Réfrigérateur américain »).
2. Pour ces références, le catalogue envoyé au modèle porte la mention `[dimensions]` : le modèle est invité à estimer largeur, profondeur et hauteur.
3. Si des dimensions sont fournies : volume = volume géométrique × coefficient de manutention, signalé « volume estimé d'après l'image », confiance plafonnée à « À vérifier » (jamais « Sûr »).
4. Sinon : volume **0**, mention « volume à renseigner » sur la fiche, hypothèse affichée sur l'estimation (« N objets sans volume de référence »), et **pas de devis formel automatique** (motif de validation humaine).
5. Le déménageur saisit le volume ; la correction est journalisée et une nouvelle version du devis peut être calculée.

Aucun volume n'est inventé. Tests : `src/lib/ai/postprocess.test.ts`, `src/lib/ai/scenarios.test.ts` (scénario 5), `src/lib/quotes/eligibility.test.ts`.

## Enrichissements faits lors de cette vérification

| Référence | Avant | Après | Source et méthode | Fiabilité |
| --- | --- | --- | --- | --- |
| `miroir-mural` | vide | 0,03 m³ (0,01–0,14) | 87 miroirs ABO (type HOME_MIRROR), percentiles, × 1,3 (fragile) | faible |
| `carton-standard` | vide | 0,1 m³ (0,075–0,125) | « Cartons (×10) » du prototype (1 m³) ÷ 10 | faible |

Correction d'un défaut du script de construction : les règles sans catégorie Amazon excluaient à tort les produits ABO sans catégorie. Neuf références déjà renseignées ont des statistiques légèrement modifiées (plus de produits pris en compte), par exemple `coiffeuse` 0,96 → 0,68 m³, `buffet-bas` 0,58 → 0,56 m³.

Écarté volontairement : `canape-panoramique` à partir des « sectional sofas » ABO (132 produits, largeur médiane 2,24 m : ce sont de petits canapés d'angle, pas des canapés en U). Laisser vide est plus honnête qu'une valeur trompeuse.

## Pistes d'enrichissement sourcé

| Piste | Références concernées | Faisabilité | Remarque |
| --- | --- | --- | --- |
| **ABO avec méthode spécifique** | `tapis` (69 tapis), `armoire-3-portes` (69 armoires, à filtrer par largeur), `armoire-de-bureau` (11 classeurs), `coffre-a-jouets` (8), `meuble-d-entree` (17), `portemanteau` | Bonne | Le tapis demande une formule « roulé » (le volume à plat n'a pas de sens) ; les armoires 3 portes doivent être isolées par la largeur |
| **Volumes saisis par l'entreprise** | Toutes | Très bonne | Recommandé : une table de volumes propres à chaque entreprise, prioritaire sur le catalogue (non développé) |
| **Fiches techniques des fabricants** | Gros électroménager (`refrigerateur-americain`, `cave-a-vin`, `cuisiniere`, `four`), sport (`rameur`, `tapis-de-course`) | Moyenne | Dimensions publiques, mais réutilisation systématique d'une base fabricant à vérifier juridiquement ; pas de collecte automatisée sans accord |
| **Grille professionnelle AFDE** | Toutes | Inconnue | Licence non établie, document inaccessible : à demander à l'AFDE |
| **Mesures des déménageurs pilotes** | Toutes, et calibration des coefficients | Très bonne | Le journal des corrections enregistre déjà les volumes corrigés : il servira à calibrer après les premiers pilotes |

## Liste des 52 références

| Identifiant | Nom | Catégorie | Lourd |
| --- | --- | --- | --- |
| `canape-panoramique` | Canapé panoramique | Salon et séjour | |
| `tapis` | Tapis | Salon et séjour | |
| `enceinte-colonne` | Enceinte colonne | Salon et séjour | |
| `piano-numerique` | Piano numérique | Autres objets volumineux | |
| `aquarium` | Aquarium | Autres objets volumineux | oui |
| `horloge-comtoise` | Horloge comtoise | Autres objets volumineux | oui |
| `plante-grande` | Grande plante en pot | Salon et séjour | |
| `buffet-cuisine` | Buffet de cuisine | Cuisine | |
| `etagere-cuisine` | Étagère de cuisine | Cuisine | |
| `refrigerateur-americain` | Réfrigérateur américain | Électroménager | oui |
| `refrigerateur-top` | Réfrigérateur top | Électroménager | |
| `cave-a-vin` | Cave à vin | Électroménager | oui |
| `four` | Four | Électroménager | |
| `cuisiniere` | Cuisinière | Électroménager | oui |
| `lit-superpose` | Lit superposé | Chambres | |
| `lit-bebe` | Lit bébé | Chambres | |
| `armoire-3-portes` | Armoire 3 portes | Chambres | |
| `dressing` | Dressing | Chambres | |
| `coffre-a-jouets` | Coffre à jouets | Chambres | |
| `meuble-vasque` | Meuble sous-vasque | Salle de bain | |
| `colonne-salle-de-bain` | Colonne de salle de bain | Salle de bain | |
| `etagere-salle-de-bain` | Étagère de salle de bain | Salle de bain | |
| `bureau-assis-debout` | Bureau assis-debout | Bureau | |
| `armoire-de-bureau` | Armoire de bureau | Bureau | |
| `imprimante` | Imprimante | Bureau | |
| `ordinateur-fixe` | Ordinateur fixe et écran | Bureau | |
| `portemanteau` | Portemanteau sur pied | Entrée et couloirs | |
| `meuble-d-entree` | Meuble d'entrée | Entrée et couloirs | |
| `etabli` | Établi | Garage et cave | oui |
| `armoire-de-garage` | Armoire de garage | Garage et cave | oui |
| `servante-outils` | Servante à outils | Garage et cave | oui |
| `tondeuse` | Tondeuse à gazon | Jardin et extérieur | oui |
| `malle` | Malle | Garage et cave | |
| `parasol` | Parasol | Jardin et extérieur | |
| `barbecue` | Barbecue | Jardin et extérieur | oui |
| `abri-de-jardin` | Abri ou coffre de jardin | Jardin et extérieur | |
| `velo-enfant` | Vélo enfant | Sport et loisirs | |
| `trottinette` | Trottinette | Sport et loisirs | |
| `tapis-de-course` | Tapis de course | Sport et loisirs | oui |
| `banc-de-musculation` | Banc de musculation | Sport et loisirs | oui |
| `rameur` | Rameur | Sport et loisirs | oui |
| `table-de-ping-pong` | Table de ping-pong | Sport et loisirs | oui |
| `baby-foot` | Baby-foot | Sport et loisirs | oui |
| `billard` | Billard | Sport et loisirs | oui |
| `planche-de-surf` | Planche de surf ou paddle | Sport et loisirs | |
| `skis` | Skis et équipement de ski | Sport et loisirs | |
| `sac-de-golf` | Sac de golf | Sport et loisirs | |
| `poussette` | Poussette | Sport et loisirs | |
| `carton-livres` | Carton livres | Cartons et emballages | |
| `carton-penderie` | Carton penderie | Cartons et emballages | |
| `sac-ou-ballot` | Sac ou ballot | Cartons et emballages | |
| `autre-objet` | Autre objet | Autres objets volumineux | |
