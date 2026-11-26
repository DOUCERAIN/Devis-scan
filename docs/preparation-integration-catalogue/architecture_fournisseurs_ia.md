# Architecture indépendante des fournisseurs IA

But : remplacer Anthropic par un modèle open source, ou en utiliser plusieurs, **sans modifier** le catalogue, le moteur de volume, le moteur tarifaire, le parcours client, l'espace professionnel ni la gestion des devis. Chaque fournisseur doit seulement respecter le contrat 2.0 (`contrat_commun_ia.json`).

Prototype exécutable : `prototypes/integration-catalogue/fournisseurs.ts`, `contrat.ts`, `resolution.ts`, `compat_v1.ts`.

## 1. Les dix composants et leurs interfaces

```
 vidéo ──► [1 Sélection des images] ──► [2 Reconnaissance] ──► [3 Candidates] ──► [4 Sélection]
                                            ▲ fournisseur IA        catalogue        modèle + serveur
                                            │ (seul composant
                                            │  interchangeable
                                            │  par fournisseur)
 [5 Suivi des exemplaires] ──► [6 Comptage] ──► [7 Consolidation] ──► [8 Dimensions] ──► [9 Volume] ──► [10 Devis]
        modèle + serveur           serveur          serveur              catalogue          serveur          serveur
```

| # | Composant | Entrée → sortie | Code actuel (V1) | Interchangeable ? |
| --- | --- | --- | --- | --- |
| 1 | Sélection des images | vidéo → images (8 par pièce, couverture temporelle) | `src/lib/video/`, `MAX_IMAGES_PER_ROOM` dans `src/lib/analysis/run.ts` | oui (algorithme), sans dépendre du fournisseur |
| 2 | Reconnaissance | images + consignes → **texte** du fournisseur | `VisionProvider.analyzeRoom` (`src/lib/ai/provider.ts`, `providers/anthropic.ts`) | **oui : un adaptateur par fournisseur** |
| 3 | Candidates | description → références classées | aucun (catalogue complet dans les consignes) | oui (structurée aujourd'hui, autre méthode demain) |
| 4 | Sélection | réponse + candidates → référence vérifiée | `matchCatalog()` | non : règle Devis Scan |
| 5 | Suivi des exemplaires | objets de plusieurs images → exemplaires distincts | consignes + `buildItems()` (doublons possibles) | règle Devis Scan |
| 6 | Comptage | exemplaires → quantité | `quantity` | règle Devis Scan |
| 7 | Consolidation | pièces → inventaire (doublons possibles, jamais retirés d'office) | `buildItems()` | règle Devis Scan |
| 8 | Dimensions | référence → dimensions et volumes de référence | `furniture_catalog` | **catalogue seul** |
| 9 | Volume | inventaire → confirmé / à vérifier / potentiel | `src/lib/inventory/volume.ts` | non |
| 10 | Devis | volume + grille de l'entreprise → prix | `src/lib/pricing/engine.ts` | non |

Interfaces proposées (TypeScript, prototype) :

```ts
// 2. Le seul composant propre au fournisseur : il renvoie un TEXTE, rien d'autre.
interface FournisseurReconnaissance {
  readonly id: string;            // « anthropic », « open-source-local », « simulation »
  readonly modele: string;        // identifiant exact du modèle
  readonly simule: boolean;       // jamais présenté comme une vraie analyse
  analyserPiece(entree: EntreePiece): Promise<string>;
}
// Commun à tous : validation, résolution, volumes.
function lireReponse(texte: string): { ok: true; reponse: ReponsePiece } | { ok: false; erreur: string };
function resoudrePiece(catalogue: Catalogue, reponse: ReponsePiece): ElementResolu[];
function rechercherCandidates(catalogue: Catalogue, requete: Requete, k?: number): Candidate[];
```

L'actuel `VisionProvider` renvoie déjà une `RoomAnalysis` validée. Dans la cible, l'adaptateur ne fait plus qu'appeler l'API et renvoyer le texte. La lecture du contrat (`lireReponse`) devient commune, et les erreurs de format sont donc traitées de la même façon pour tous.

## 2. Ce qu'un fournisseur ne fait jamais

- Il n'a pas son propre catalogue : il reçoit le texte généré depuis **le** catalogue (`texteCatalogue()`), versionné.
- Il ne calcule aucun volume : les champs `volume`, `prix` sont refusés par le contrat (`additionalProperties: false`).
- Il ne décide pas des doublons : il signale `doute_identite` ; le déménageur tranche, comme aujourd'hui.

## 3. Traçabilité, comparaison, secours, rejeu

Chaque appel produit une **enveloppe serveur** (`enveloppeSchema`) : `id_analyse`, `id_piece`, `fournisseur`, `modele`, `version_consignes` (empreinte du texte), `version_catalogue` et `empreinte_catalogue` (SHA-256 du JSON du catalogue), `horodatage`, `reponse_brute` (texte original, jamais modifié), `reponse` (si conforme), `erreur`.

| Besoin | Mécanisme (prototype) |
| --- | --- |
| Comparer des fournisseurs | `comparer(a, b)` : différences objet par objet (référence, quantité, statut, confirmation) ; à brancher sur `tests/ai-eval/` (benchmark existant, budget plafonné) |
| Changer de fournisseur | configuration (`AI_PROVIDER`, `AI_MODEL`) : seul l'adaptateur change |
| Fournisseur de secours | `analyserAvecSecours([principal, secours…])` : le premier qui répond au contrat est retenu ; toutes les tentatives sont conservées |
| Rejouer une demande | `rejouer(enveloppe, catalogue)` : même réponse, catalogue actuel (identifiants remplacés signalés) ; ou nouvel appel avec un autre fournisseur sur les mêmes images |
| Conserver les réponses originales | `reponse_brute` dans l'enveloppe (aujourd'hui `analysis_runs.raw_output`) |
| Comparer des versions | enveloppes de deux versions de consignes ou de catalogue → `comparer` |

Point de vigilance « résultat identique quel que soit le fournisseur » : la **résolution** est identique pour une même réponse normalisée (testé). Deux modèles différents ne verront pas forcément les mêmes objets : c'est ce que mesure le benchmark, pas une propriété garantie.

## 4. Compatibilité et versions

| Situation | Traitement |
| --- | --- |
| Réponses V1 déjà en base (`raw_output`) | `depuisV1()` les convertit au contrat 2.0 ; les identifiants de l'ancien catalogue deviennent des alias historiques |
| Catalogue mis à jour | chaque analyse garde `version_catalogue` ; les identifiants ne sont jamais réutilisés ; un retrait passe par `remplacements` (ancien → nouveau) |
| Consignes modifiées | nouvelle `version_consignes` (empreinte), visible dans chaque enveloppe |
| Nouveau modèle | nouvel adaptateur ou simple changement d'`AI_MODEL` ; rien d'autre ne change |

## 5. Modèles open source : points d'attention

- **Sortie structurée** : tous n'imposent pas un schéma JSON. Le contrat est revérifié côté serveur dans tous les cas, et `extraireJson()` retire les balises ```json.
- **Fenêtre de contexte** : environ 4 400 jetons de catalogue, plus 8 images par pièce. Pour un petit modèle, on procède en deux passages : d'abord la famille et les caractéristiques, puis les candidates de cette famille seulement.
- **Images multiples** : certains modèles n'acceptent qu'une image par appel. L'adaptateur fait alors un appel par image, et la consolidation (composant 7) regroupe les résultats. C'est la même règle que pour les doublons.
- **Hébergement** : un serveur local (machine avec processeur graphique) ou un service tiers. Choix à faire au moment voulu ; aucune incidence sur le reste.

## 6. Évolutions de base de données nécessaires (non appliquées)

À préparer dans une future migration **non destructive** (aucune n'est écrite ni appliquée ici) :

- `analysis_runs` : `contract_version`, `prompt_version`, `catalog_version`, `catalog_hash`, et un journal des tentatives (fournisseur de secours) ;
- `inventory_items` : `catalog_reference_id` (référence v5, en plus de `catalog_key`), `reference_status` (`trouvee`, `a_confirmer`, `inconnue`, `alias_historique`, `remplacee`…), `alternatives`, `indices` ;
- tables `catalog_references` (catalogue v5 normalisé) et `catalog_aliases` (anciens identifiants, remplacements), en lecture publique comme `furniture_catalog` aujourd'hui ;
- les volumes géométrique et de déménagement restent dans deux colonnes distinctes.
