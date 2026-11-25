# Protocole du benchmark IA — Devis Scan

Version 1 · préparé le 25/11/2026 · **aucun résultat à ce jour** (aucun appel réel effectué pour ce benchmark).

## 1. Objectif

Choisir le modèle qui offre le meilleur compromis pour l'analyse des pièces filmées par les particuliers :

| Critère | Comment il est mesuré |
| --- | --- |
| Précision de reconnaissance des meubles | Meubles corrects, oubliés, inventés ; rappel, précision, F1 |
| Catégories de mobilier | Même calcul au niveau de la sous-catégorie du catalogue (Lits, Canapés, Rangements…) |
| Volumes (m³) | Volume compté par le post-traitement comparé au volume de référence |
| Meubles partiellement cachés | Rappel sur les meubles marqués `partial` dans la référence |
| Doublons entre images | Meubles comptés plus de fois qu'ils n'existent ; doublons possibles signalés (toujours comptés, à trancher par une personne) |
| Objets difficiles ou ambigus | Rappel sur les objets marqués `difficult` |
| Coût par demande client | Coût réel (jetons facturés × tarif officiel), moyenne par pièce × nombre de pièces d'une demande |
| Temps de réponse | Durée de chaque appel (moyenne et maximum) |

## 2. Modèles comparés

| Modèle | Identifiant exact | Tarif (USD / million de jetons) entrée · sortie · écriture cache 5 min · lecture cache |
| --- | --- | --- |
| Claude Haiku 5.5 | `claude-haiku-5-5` | 0,10 · 0,50 · 0,125 · 0,01 (× 5 au-delà de 100 000 jetons d'entrée, sur toute la requête) |
| Claude Sonnet 5.5 | `claude-sonnet-5-5` | 2 · 10 · 2,50 · 0,10 |
| Claude Opus 5.5 | `claude-opus-5-5` | 4 · 20 · 5 · 0,20 |

Identifiants et tarifs vérifiés le 25/11/2026 dans la documentation officielle (pages « Models overview » et « Pricing »). L'identifiant `claude-haiku-5-5` a aussi été confirmé par la réponse de l'API lors de l'appel de test du 25/11/2026. Les tarifs sont dans `src/lib/ai/cost.ts`. Le rapport affiche le modèle qui a réellement répondu.

## 3. Conditions identiques pour les trois modèles

- **Mêmes images**, dans le même ordre, issues du vrai parcours client : compression, extraction et sélection des images de la phase 3.
- **Mêmes consignes**, même catalogue et même format de sortie que la production (`src/lib/ai/prompt.ts`, `src/lib/ai/output.ts`).
- **Même post-traitement** (`src/lib/ai/postprocess.ts`) : rattachement au catalogue, volumes, doublons possibles.
- Même effort (`medium` par défaut, le réglage de production).
- Même plafond de sortie : 7 000 jetons par défaut, réflexion comprise. C'est la limite qui permet de garantir le budget, voir le § 6.
- **Aucune nouvelle tentative automatique.** **Pas de repli serveur vers un autre modèle** : en production, un refus de Sonnet ou d'Opus peut être repris par un autre modèle ; ici, ce serait mesurer un autre modèle.
- Les appels sont faits pièce par pièce, et l'ordre des modèles change d'une pièce à l'autre. Si le banc s'arrête en cours de route, les pièces déjà traitées restent comparables.
- Le cache du catalogue fonctionne comme en production, séparément pour chaque modèle.

## 4. Jeu de données

Organisation : `tests/ai-eval/dataset/<cas>/case.json` et `tests/ai-eval/dataset/<cas>/frames/*.jpg`. Un cas correspond à une pièce. Format et ajout de cas : `dataset/README.md`.

Couverture minimale d'un benchmark **représentatif** (contrôlée par le script) :

| Élément | Minimum |
| --- | --- |
| Cas au total | 12 (≈ 96 images, 8 par pièce comme en production) |
| Salon · Chambre · Cuisine · Salle de bain · Garage ou cave | 2 · 2 · 2 · 1 · 2 |
| Pièces encombrées | 3 |
| Mobilier partiellement visible | 4 |
| Plusieurs angles d'un même meuble (vraie vidéo, pas un panoramique sur une photo) | 3 |
| Objets difficiles ou ambigus | 2 |
| Références validées par une personne | toutes |

Un même cas peut couvrir un type de pièce et plusieurs situations.

État au 25/11/2026 : 3 cas (24 images), tirés de 3 photos réelles sous licence libre. Chacune a été transformée en panoramique, puis passée par le vrai parcours client. Couverture : 1 salon, 1 chambre, 1 bureau encombré. Aucune cuisine, aucune salle de bain, aucun garage, aucune vraie prise de vue multiple. Références provisoires. **Ce jeu permet un premier essai technique, pas un choix de modèle.**

Les images des clients ne sont jamais utilisées (voir `docs/analyse-ia.md`, « Confidentialité »).

## 5. Référence humaine

Chaque cas contient l'inventaire de la pièce établi par une personne (`reference` dans `case.json`) :

- **objets à déménager seulement** : le mobilier fixe, les rideaux et les effets personnels sont ignorés ;
- quantité exacte ;
- `alternatives` : autres identifiants du catalogue acceptés (bibliothèque ou étagère, par exemple) ;
- `optional` : objet ambigu ou minime, qui ne compte ni comme oubli ni comme erreur ;
- `partial` : meuble partiellement caché ; `difficult` : objet difficile à reconnaître ;
- `volume_m3` : volume mesuré, facultatif, prioritaire sur le volume moyen du catalogue.

Une référence n'est **validée** qu'après vérification par un déménageur ou par le porteur du projet : il faut alors remplir `status: "validee"`, `validated_by` et `validated_at`. Tant qu'une référence est provisoire, le rapport l'affiche en tête.

Si une référence est corrigée après un passage, la commande `--rescore` recalcule les scores à partir des réponses déjà enregistrées, sans nouvel appel ni dépense.

## 6. Budget et sécurité

| Règle | Mise en œuvre |
| --- | --- |
| 0,75 $ maximum par modèle (premier benchmark) | Option `--max-usd-per-model`, 0,75 par défaut |
| 5 $ maximum pour toute la campagne | `CAMPAIGN_HARD_CAP_USD = 5` dans `src/lib/ai/benchmark/budget.ts`. Aucune option ne permet de dépasser ce montant. Le registre `results/ledger.json` cumule tous les passages et doit être conservé dans Git. |
| Arrêt si le plafond est atteint ou risque de l'être | Avant le lancement, le coût maximal de tout le passage doit tenir dans les plafonds, sinon aucun appel ne part. Avant chaque appel, son coût maximal est réservé dans le registre ; s'il peut faire dépasser un plafond, le script s'arrête. |
| Coût maximal d'un appel | Toute l'entrée comptée au tarif le plus cher (écriture en cache, et palier supérieur de Haiku si le seuil peut être franchi). Images : ⌈largeur/28⌉ × ⌈hauteur/28⌉ jetons. Texte : 1 jeton pour 2 caractères. Marge de 1 500 jetons, puis de 10 %. Sortie comptée au plafond `max_tokens` : l'API ne peut pas facturer plus. |
| Aucun appel supplémentaire en cas d'erreur | SDK réglé sur `maxRetries: 0`. Une erreur de l'API (réseau, 429, 5xx) ou une erreur inattendue arrête tout le passage. Un refus ou une réponse illisible est noté comme un échec, sans nouvel essai. |
| Comptabilisation après chaque appel | Jetons (entrée, cache écrit, cache lu, sortie) et coût réel affichés au format français (`formatCostUsd`) et enregistrés. Si l'API n'a pas renvoyé ses jetons, la réservation maximale reste comptée. |
| Aucun rechargement automatique de crédits | Le script ne peut pas le garantir : c'est un réglage de la console Anthropic. **À vérifier avant le lancement** : Console → Billing, désactiver le rechargement automatique (« auto-reload ») et, si possible, fixer une limite de dépense mensuelle. |
| Clé et adresse | La clé est lue uniquement dans `DEVIS_SCAN_ANTHROPIC_API_KEY`. Les requêtes partent uniquement vers `https://api.anthropic.com` : tout autre hôte est refusé avant l'envoi (`src/lib/ai/anthropic-client.ts`). La clé n'est jamais affichée, seulement sa présence et sa longueur. |
| Lancement explicite | Sans `--confirm`, le script contrôle le jeu de données et le budget, puis s'arrête sans aucun appel. |

Coût maximal du premier benchmark, avec les 3 cas actuels, effort medium et sortie ≤ 7 000 jetons :

| Modèle | Coût maximal (3 pièces) | Plafond |
| --- | --- | --- |
| Haiku 5.5 | 0,0175 $ | 0,75 $ |
| Sonnet 5.5 | 0,35 $ | 0,75 $ |
| Opus 5.5 | 0,701 $ | 0,75 $ |
| **Total** | **1,07 $** | 5 $ (campagne) |

Ces montants sont des **bornes hautes**. Le coût réel sera mesuré, et il est attendu plus bas car le pire cas suppose une sortie au plafond. Pour un benchmark représentatif de 12 pièces, le pire cas est d'environ 4,28 $ (Opus ≈ 2,80 $, Sonnet ≈ 1,40 $, Haiku ≈ 0,07 $) : il faudra relever le plafond par modèle (`--max-usd-per-model`) et vérifier ce qu'il reste dans la campagne.

## 7. Notation

Les règles sont déterministes (`src/lib/ai/benchmark/score.ts`) et testées (`score.test.ts`).

1. **Rattachement** : chaque objet détecté passe par le post-traitement de production. Un identifiant du catalogue, ou une alternative acceptée, est comparé à la référence. Un objet hors catalogue ne correspond à rien.
2. Pour chaque référence : **corrects** = min(détectés, attendus) ; **oubliés** = attendus − détectés si l'écart est positif ; **en trop** = détectés − attendus si l'écart est positif. Un meuble en trop correspond à un même meuble compté plusieurs fois, souvent parce qu'il est vu sous plusieurs angles.
3. **Inventés ou mal identifiés** : objets comptés dont la référence n'existe pas dans la pièce.
4. **Doublons possibles** : objets signalés par le post-traitement. Comme en production depuis le 26/11/2026, ils restent comptés jusqu'à la décision d'une personne. Un signalement est « justifié » si l'objet de référence était déjà compté en totalité, ce qui correspond à un vrai surcomptage ; sinon, c'est une fausse alerte.
5. **Facultatifs** : ils ne comptent ni comme oubli ni comme erreur.
6. **Partiellement cachés et difficiles** : les objets retrouvés sont attribués d'abord aux lignes non marquées. Un meuble caché n'est donc compté comme retrouvé que si tous les meubles visibles de même type l'ont été.
7. **Volume** : la référence est une fourchette, des objets obligatoires jusqu'aux objets facultatifs compris, avec le volume mesuré s'il est connu. L'erreur est la distance à cette fourchette. L'erreur relative est rapportée au volume obligatoire.
8. **Échec d'un appel** (refus, réponse tronquée ou illisible) : il est noté comme une analyse vide, donc tous les objets de la pièce sont oubliés.
9. **Agrégation** : les comptes sont additionnés sur toutes les pièces, puis les taux sont calculés.

**Score de qualité sur 100** : moyenne pondérée, avec les poids suivants.

| Critère | Poids |
| --- | --- |
| Meubles : F1 (rappel et précision) | 40 % |
| Catégories : F1 | 15 % |
| Volume : 1 − erreur relative | 15 % |
| Partiellement cachés : rappel | 10 % |
| Difficiles : rappel | 10 % |
| Doublons : 1 − en trop / attendus | 10 % |

Un critère non mesurable sur le jeu de données (aucun objet marqué) est signalé, et son poids est réparti sur les autres. Les poids sont un choix : ils sont affichés dans chaque rapport et modifiables (`QUALITY_WEIGHTS`). Les mesures brutes restent toujours visibles.

**Suggestion de compromis**, que le script affiche mais qu'une personne doit confirmer : le modèle le moins cher qui n'a aucun échec et qui se trouve à moins de 5 points du meilleur score. Elle est marquée « indicative » tant que les références ne sont pas validées ou que le jeu n'est pas représentatif.

## 8. Déroulé

1. Préparer le jeu de données et valider les références (`dataset/README.md`).
2. Contrôle sans appel :

   ```bash
   node --conditions=react-server tests/ai-eval/bench.ts
   ```
3. Vérifier dans la console Anthropic que le rechargement automatique est désactivé.
4. **Après accord explicite du porteur du projet**, lancer les appels réels :

   ```bash
   node --conditions=react-server tests/ai-eval/bench.ts --confirm
   ```
5. Lire `results/<passage>/rapport.md`. Les fichiers `comparatif.csv` et `details.csv` s'ouvrent dans un tableur. Committer `results/` (registre compris).
6. Après une correction de référence, renoter sans appel :

   ```bash
   node --conditions=react-server tests/ai-eval/bench.ts --rescore tests/ai-eval/results/<passage>/resultats.json
   ```

## 9. Livrables d'un passage

`results/<passage>/` contient :
- `resultats.json` : configuration, tarifs, réponses brutes de chaque modèle, jetons, coût et durée de chaque appel. Ce fichier permet de renoter sans nouvel appel.
- `rapport.md` : tableau comparatif final, détail des scores, détail par pièce, couverture, budget, liste des appels.
- `comparatif.csv` : une ligne par modèle. `details.csv` : une ligne par appel. Format tableur français (`;` et virgule décimale).

Le registre de campagne est `results/ledger.json`.

## 10. Limites connues

- Les 3 cas actuels sont des photos de catalogue ou d'hôtel, avec une seule prise de vue : ils ne représentent pas une vraie vidéo filmée au téléphone.
- Le volume de référence repose sur les volumes moyens du catalogue, sauf si un volume mesuré est fourni. L'erreur de volume mesure donc surtout les erreurs d'inventaire.
- Un passage unique ne mesure pas la variabilité des réponses : utiliser `--repeat 2` quand le budget le permet.
- Les seuils de confiance et les poids du score restent à recalibrer avec de vrais logements.
