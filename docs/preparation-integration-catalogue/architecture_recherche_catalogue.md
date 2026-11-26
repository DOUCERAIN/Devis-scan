# Architecture de recherche des références du catalogue

Objectif : quel que soit le modèle IA, un objet vu dans une vidéo est rattaché à **un identifiant existant** du catalogue Devis Scan (v5 : 311 sous-catégories, 204 variantes de taille, 515 entrées). Le serveur lit ensuite les dimensions et les volumes dans le catalogue. Le modèle n'invente jamais une référence, un volume ou un prix.

Prototype exécutable, testé et non branché : `prototypes/integration-catalogue/` (`recherche.ts`, `resolution.ts`, `consignes.ts`, `index_catalogue_v5.json`).

## 1. Ce qui existe aujourd'hui (moteur V1, inchangé)

| Étape | Code actuel | Limite pour la suite |
| --- | --- | --- |
| Catalogue remis au modèle | `catalogPrompt()` dans `src/lib/ai/prompt.ts` : les 134 références de `furniture_catalog`, une ligne chacune | ancien catalogue ; pas de famille ni de caractéristique discriminante |
| Choix | le modèle renvoie `catalog_id` (`src/lib/ai/output.ts`) | pas d'alternatives, pas de statut « à confirmer », pas d'indices |
| Rattachement | `matchCatalog()` (`src/lib/ai/postprocess.ts`) : identifiant exact, sinon nom ou synonyme exacts ; jamais d'approximation | bon principe, à conserver |
| Volume | `unitVolume()` : volume de déménagement du catalogue, sinon dimensions estimées par le modèle × coefficient de manutention | le second cas utilise des dimensions estimées par l'IA : à remplacer par « volume à saisir » ou par une référence comparable validée |
| Traçabilité | `analysis_runs` : `provider`, `model`, `raw_output` | ni version du catalogue, ni version des consignes |

## 2. Principe retenu

```
 Images de la pièce
        │
        ▼
 ┌──────────────────────────┐   consignes v2 + catalogue compact (identifiants, noms,
 │ Modèle IA (tout fournisseur)│ ◄─ caractéristiques discriminantes ; jamais de volume)
 └──────────────────────────┘
        │ contrat 2.0 : famille, caractéristiques vues, reference_id, alternatives, indices, confiance
        ▼
 ┌──────────────────────────┐
 │ Validation du contrat    │  zod ; tout champ inconnu (volume, prix…) refusé
 └──────────────────────────┘
        ▼
 ┌──────────────────────────┐  - identifiant existe ? sinon « identifiant_inexistant »
 │ Résolution (serveur)     │  - ancien identifiant ? alias historique / remplacement
 │                          │  - cohérence famille / sous-catégorie / caractéristiques
 │                          │  - recherche structurée : candidates, alternatives proposées
 └──────────────────────────┘
        ▼
 ┌──────────────────────────┐
 │ Catalogue (source unique)│  dimensions médianes, volume géométrique (médiane, Q1, Q3),
 └──────────────────────────┘  volume de déménagement de référence (séparé), fiabilité
        ▼
 Inventaire → moteur de volume (confirmé / à vérifier / potentiel) → moteur de devis
```

## 3. Méthodes de recherche comparées

Mesures du prototype : 515 entrées en mémoire, environ 1 ms par recherche (non optimisée), index de 0,7 Mo.

| Méthode | Précision attendue | Rapidité | Coût | Maintenance | Nouvelles références | Tous modèles ? | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Identifiant exact (le modèle choisit dans la liste) | élevée si la liste est claire | immédiate | nul | nulle | ajout dans le catalogue | oui | **base** |
| Synonymes français et anciens noms (134 alias) | bonne pour le texte libre | immédiate | nul | faible | ajouter des synonymes | oui | **retenue** |
| Mots-clés multilingues (tirés de la taxonomie : anglais, allemand, italien, espagnol, néerlandais) | bonne pour les modèles qui répondent en anglais | immédiate | nul | nulle (générés) | automatique | oui | **retenue** |
| Caractéristiques chiffrées (portes, places, tiroirs, largeur de couchage, diagonale, longueur, hauteur) | **élevée** pour départager des sous-catégories voisines | immédiate | nul | faible (critères tirés des caractéristiques discriminantes) | automatique si la description est rédigée sur le même modèle | oui | **retenue, cœur du classement** |
| Dimensions apparentes → variante de taille | moyenne (estimation visuelle imprécise) | immédiate | nul | nulle | automatique | oui | **retenue, poids faible** |
| Recherche textuelle floue (distance d'édition) | faible gain, risque de rapprochements absurdes | rapide | nul | faible | — | oui | non nécessaire |
| Recherche sémantique ou vectorielle (plongements de texte) | utile pour un texte libre très varié ou plus de 5 000 références | rapide | calcul des plongements, éventuellement payant | modèle de plongement à versionner | recalcul | oui | **pas maintenant** : 311 sous-catégories bien décrites suffisent ; à réévaluer si le catalogue dépasse quelques milliers de références commerciales |
| Recherche par image (plongements visuels) | prometteuse à long terme | variable | élevé | lourde | jeu d'images de référence nécessaire (droits) | dépend | hors périmètre |

## 4. Recommandation : hybride en deux niveaux

**Niveau 1 : catalogue compact dans les consignes.** Le catalogue des niveaux de pertinence 1 à 3 (292 sous-catégories, sans les variantes) représente environ **4 400 jetons**, mis en cache par les fournisseurs qui le permettent. Il est donc transmis en entier à chaque pièce, comme en V1 (134 références aujourd'hui). Le modèle choisit une sous-catégorie et justifie son choix par des caractéristiques observées. Les variantes de taille ne sont **pas** demandées au modèle : le serveur les déduit, si utile, des dimensions apparentes, et les présente comme une indication.

**Niveau 2 : recherche structurée côté serveur**, utilisée pour :

1. vérifier le choix (identifiant existant, famille et caractéristiques cohérentes : un lit avec « nb_portes = 2 » déclenche une confirmation) ;
2. proposer au déménageur les **alternatives classées** quand le modèle hésite ;
3. relancer un **deuxième passage ciblé**, uniquement pour les objets ambigus : texte seul, quelques candidates, sans images si possible ;
4. servir les modèles à **petite fenêtre de contexte** (modèles open source locaux) : leur envoyer seulement la famille et ses candidates, après un premier passage « famille + caractéristiques ».

Pourquoi pas la base vectorielle : la précision dépend ici de caractéristiques physiques discrètes (2 portes contre 3), qu'une recherche structurée compare exactement et de façon explicable. Une base vectorielle ajouterait un composant à héberger, un modèle de plongement à versionner, et des rapprochements difficiles à justifier, pour un catalogue qui tient en mémoire.

## 5. Classement des candidates (prototype `recherche.ts`)

Score additif, chaque point est justifié dans `raisons` (vérifiable) :

| Indice | Effet |
| --- | --- |
| Famille reconnue | filtre (+10) ; autre famille exclue |
| Nom ou synonyme exact | +8 ; mots communs : jusqu'à +6 ; mots-clés multilingues : jusqu'à +5 |
| Caractéristique compatible (ex. 2 portes pour `ARM-2P`) | +6 ; incompatible : −8 |
| Dimensions apparentes compatibles (longueur, hauteur, volume dans la plage d'une variante) | +1 à +4 |
| Caractéristique visible → le repli « (non précisé) » recule | −6 |
| Pertinence (courant +1, complémentaire +0,5, peu pertinent −1) ; mobilier ancien seulement si `ancien` | — |
| Sans famille : score minimal 4 | sinon aucune candidate → « référence inconnue » |

Le repli « (non précisé) » de la famille est **toujours** proposé en dernier : le modèle n'est jamais obligé de choisir une référence trop précise.

Exemples réels du prototype (catalogue v5) :

| Objet décrit | 1re candidate | Suivantes |
| --- | --- | --- |
| armoire, 2 portes | `ARM-2P` | `ARM-COUL`, `ARM-BAS`, `ARM-ANG`, repli `ARM-NC` |
| armoire, 4 portes | `ARM-4P` | `ARM-COUL`, `ARM-NC` |
| canapé, places non visibles | `CAN-2P` | `CAN-ANG`, `CAN-NC` |
| lit, couchage 180 cm | `LIT-KING` | variantes `LIT-KING-C/S/L`, repli `LIT-NC` |
| réfrigérateur américain | `ELM-REF-US` | `ELM-REF`, `ELM-REF-1P` |
| table extensible 160 × 90 cm | `TAB-REPAS-NC-S` | `TAB-6`, `TAB-REPAS-NC` |
| cabine de sauna | *(aucune)* | → « référence inconnue » |

## 6. L'exemple de l'armoire

Le catalogue v5 n'a **pas** de variantes de taille pour `ARM-2P` : 12 modèles seulement, alors qu'une variante exige au moins 15 modèles et une forte dispersion. Le système se comporte ainsi :

1. le modèle décrit : `famille_id = ARM`, `nb_portes = 2`, hauteur apparente 200 cm ;
2. il choisit `ARM-2P` et cite ses indices (« deux portes battantes visibles », « hauteur proche du plafond ») ;
3. le serveur lit `ARM-2P` : volume géométrique médian 0,876 m³ (Q1 0,609 – Q3 1,105), 12 modèles, fiabilité moyenne, volume de déménagement hérité 0,8 m³ ;
4. la hauteur apparente est affichée au déménageur comme indice, sans modifier le volume ;
5. si la troisième porte est cachée : `statut_reference = "a_confirmer"`, alternatives `ARM-3P`, confirmation demandée.

Pour les sous-catégories qui ont des variantes (`CAN-ANG`, `LIT-KING`, `TAB-REPAS-NC`…), le choix d'une variante n'est accepté que s'il est justifié par des dimensions apparentes. Sinon, la sous-catégorie de base est retenue.

## 7. Cas particuliers

| Cas | Traitement |
| --- | --- |
| Référence inconnue | `statut_reference = "inconnue"`, `reference_id = null` → « dimensions à saisir », aucun volume |
| Identifiant inventé | refusé (`identifiant_inexistant`), traité comme inconnu, confiance plafonnée à « incertain » |
| Hésitation | `a_confirmer` + jusqu'à 3 alternatives existantes → confirmation par le client ou le déménageur |
| Sous-catégorie à dimensions partielles (réfrigérateurs) | référence retenue, volume géométrique **non disponible** ; volume de déménagement hérité affiché s'il existe ; signalé |
| Sous-catégorie non mesurable (`DIV-AUTRE`, `CAR-SAC`) | volume toujours saisi par une personne |
| Ancien identifiant (V1, 134 références) | alias historique → référence principale v5 ; les 134 sont tous rattachés |
| Identifiant retiré dans une version future | table `remplacements` du catalogue → statut `remplacee`, référence demandée conservée |
