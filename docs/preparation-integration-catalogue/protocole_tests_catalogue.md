# Protocole de tests simulés — catalogue et contrat IA

**Aucun appel payant, aucun modèle réel.** Les tests utilisent l'index généré depuis le catalogue v5 et des fournisseurs simulés dont la réponse est écrite à l'avance (marqués `simule: true`, jamais présentés comme une analyse).

## Lancer

```bash
python3 prototypes/integration-catalogue/construire_index.py        # régénère l'index depuis data/catalogue-v5/
node --test "prototypes/integration-catalogue/*.test.ts"             # 34 tests
python3 -m unittest scripts/catalogue_v5/test_eprel.py               # 5 tests EPREL sur réponses fictives
```

Résultat au 26/11/2026 : **34 / 34** et **5 / 5** réussis.

## Cas représentatifs

Volumes lus dans le catalogue v5 (empreinte `bad9b4adef89…`). Un test vérifie que l'empreinte n'a pas changé : si le catalogue évolue, les attentes doivent être revues consciemment, jamais adaptées en silence.

| Objet | Famille | Sous-catégorie attendue | Référence attendue | Variantes possibles | Volume | Géométrique médian (Q1 – Q3), m³ | Déménagement hérité, m³ | Fiabilité | Incertitude à gérer |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Armoire une porte | ARM | `ARM-1P` | `ARM-1P` | — | reference_geometrique | 0,507 (0,505 – 0,566) | 0,500 | faible | fiabilité faible (3 modèles) : volume provisoire |
| Armoire deux portes | ARM | `ARM-2P` | `ARM-2P` | — | reference_geometrique | 0,876 (0,609 – 1,105) | 0,800 | moyenne | pas de variante de taille (12 modèles) : la taille apparente ne change pas la référence |
| Armoire quatre portes | ARM | `ARM-4P` | `ARM-4P` | `ARM-5P+`, `ARM-COUL` | reference_geometrique | 2,173 (1,853 – 2,337) | 1,200 | faible | fiabilité faible (3 modèles) ; volume géométrique 2,17 m³ contre 1,2 m³ de volume de déménagement hérité : à arbitrer |
| Canapé deux places | CAN | `CAN-2P` | `CAN-2P` | — | reference_geometrique | 1,317 (1,122 – 1,470) | 1,000 | élevée | nombre de places masqué par des coussins → CAN-NC et confirmation |
| Canapé trois places | CAN | `CAN-3P` | `CAN-3P` | — | reference_geometrique | 1,459 (1,262 – 1,667) | 1,500 | élevée | — |
| Canapé d'angle | CAN | `CAN-ANG` | `CAN-ANG` | `CAN-ANG-C`, `CAN-ANG-S`, `CAN-ANG-L` | reference_geometrique | 2,046 (1,712 – 3,104) | 1,620 | élevée | variante choisie seulement si les dimensions apparentes la justifient |
| Lit double | LIT | `LIT-DOUBLE` | `LIT-DOUBLE` | `LIT-DOUBLE-C`, `LIT-DOUBLE-S`, `LIT-DOUBLE-L` | reference_geometrique | 1,023 (0,898 – 2,217) | 1,200 | moyenne | largeur de couchage souvent non mesurable sur image : LIT-NC + confirmation |
| Lit king size | LIT | `LIT-KING` | `LIT-KING` | `LIT-KING-C`, `LIT-KING-S`, `LIT-KING-L` | reference_geometrique | 3,213 (1,396 – 5,130) | 2,070 | moyenne | volume géométrique du lit monté (3,21 m³) ≠ volume transporté démonté (2,07 m³ hérité) |
| Réfrigérateur combiné | ELM | `ELM-REF-COMBI` | `ELM-REF-COMBI` | `ELM-REF` | dimensions_partielles | — (— – —) | 0,400 | non vérifiée | dimensions partielles (hauteur et largeur, ENERGY STAR) : aucun volume géométrique, volume de déménagement hérité seulement |
| Réfrigérateur américain | ELM | `ELM-REF-US` | `ELM-REF-US` | `ELM-REF` | dimensions_partielles | — (— – —) | — | non vérifiée | dimensions partielles, aucun volume de déménagement : volume à saisir (EPREL comblerait) |
| Grande plante en pot | PLA | `DEC-PLANTE` | `DEC-PLANTE` | `PLA-ARBRE` | non_disponible | — (— – —) | — | non vérifiée | aucune dimension de référence : volume non disponible |
| Petite plante en pot | PLA | `—` | `inconnue` | — | non_disponible | — (— – —) | — | — | absente du catalogue (objet à mettre en carton) : le modèle doit répondre « inconnue » |
| Bureau d'angle | BUR | `BUR-ANGLE` | `BUR-ANGLE` | — | reference_geometrique | 1,303 (1,256 – 1,406) | 1,520 | moyenne | — |
| Table à manger extensible | TAB | `TAB-6` | `TAB-6` | `TAB-REPAS-NC`, `TAB-8+` | reference_geometrique | 1,129 (1,129 – 1,129) | 0,800 | faible | position fermée ou ouverte inconnue : à confirmer ; aucune sous-catégorie « extensible » en v5 |
| Cabine de sauna d'intérieur | — | `—` | `inconnue` | — | non_disponible | — (— – —) | — | — | aucun équivalent : « inconnue », dimensions à saisir |
Pour chaque cas, le test vérifie :
- que la référence attendue figure parmi les **trois premières candidates** de la recherche ;
- qu'une réponse simulée qui la choisit est acceptée (statut « trouvée », bonne sous-catégorie) ;
- que le **volume renvoyé est celui du catalogue** : statut, médiane, volume de déménagement et fiabilité ;
- que les variantes citées existent.

Pour les objets absents (petite plante, cabine de sauna), le test vérifie le statut « inconnue », l'absence de tout volume et la demande de confirmation.

## Propriétés vérifiées

| # | Propriété | Test |
| --- | --- | --- |
| 1 | Le modèle ne peut pas inventer un identifiant | `ARM-2P-XXL` → `identifiant_inexistant`, aucun volume, confirmation requise, confiance « incertain » |
| 2 | Une référence inconnue est signalée | statut `inconnue` → volume `non_disponible`, « dimensions à saisir » |
| 3 | Un objet incertain part en confirmation | `a_confirmer` avec alternatives ; ou confiance < 0,6 |
| 4 | Incohérence détectée | lit déclaré avec la référence `ARM-2P` → `a_confirmer` |
| 5 | Le volume correspond à la référence retenue | volumes des 15 cas comparés au catalogue ; dimensions apparentes de 400 cm ignorées |
| 6 | Géométrique ≠ déménagement | totaux séparés ; objets sans volume listés (`ELM-REF-US`) |
| 7 | Même résultat quel que soit le fournisseur | fournisseurs A (JSON brut) et B (balises ```json, clés dans un autre ordre) → `comparer` : identiques |
| 8 | Secours | panne, puis réponse non JSON, puis réponse valide : 3 tentatives conservées, la 3e retenue, versions de catalogue et de consignes enregistrées |
| 9 | Comparaison | un fournisseur qui choisit `ARM-3P` et oublie un objet : différences listées |
| 10 | Le catalogue peut évoluer sans casser les anciens dossiers | catalogue « 6.0-essai » où `ARM-2P` est remplacé : rejeu → `remplacee`, référence demandée conservée, volume de la nouvelle référence |
| 11 | Anciennes réponses V1 relues | `armoire-2-portes` → `ARM-2P` (alias), `autre` → inconnue, visibilité incertaine → confirmation ; la conversion produit un contrat 2.0 valide |
| 12 | Les 134 identifiants historiques sont tous rattachés | aucun sans correspondance |
| 13 | Le contrat refuse volume et prix | champ `volume_m3` ou `prix` → refus |
| 14 | Réponse non JSON ou mauvaise version | refus sans exception, erreur conservée |
| 15 | Schéma JSON publié = contrat zod | mêmes champs, `additionalProperties: false` |
| 16 | Consignes stables, sans volume ni prix | texte du catalogue identique d'un appel à l'autre, sans « m³ », « € » ni « volume » |
| 17 | Recherche : caractéristique visible prioritaire | 4 portes → `ARM-4P` devant le repli `ARM-NC` |
| 18 | Recherche : rien plutôt qu'une référence absurde | « cabine de sauna » → aucune candidate |
| 19 | EPREL : mm → cm, emballage ignoré, dimension manquante jamais complétée, niveau de droits 3 par défaut, téléchargement refusé sans clé | `test_eprel.py` |

## Ce que ces tests ne prouvent pas

- La **qualité de reconnaissance** d'un vrai modèle sur de vraies images : c'est l'objet du benchmark `tests/ai-eval/`. Il demande votre accord explicite, avec un budget plafonné (0,75 $ par modèle, 5 $ au total).
- L'exactitude des volumes eux-mêmes : voir `data/catalogue-v5/rapport_audit_dimensions.md`.

## Étape suivante (avec votre accord) : benchmark réel

1. Ajouter au jeu `tests/ai-eval/dataset/` les 15 cas, avec des images réelles et dont les droits sont clairs.
2. Noter chaque modèle sur : objet trouvé, bonne sous-catégorie, alternatives pertinentes, « inconnue » quand il le faut, aucune référence inventée.
3. Comparer Haiku, Sonnet et un modèle open source avec le **même** contrat et les **mêmes** consignes.
