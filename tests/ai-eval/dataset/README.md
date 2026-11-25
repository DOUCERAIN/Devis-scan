# Jeu de données du benchmark IA

Un dossier par pièce. Il contient la fiche `case.json` (description de la pièce et inventaire de référence) et les images dans `frames/`. Pour relancer le benchmark sur de nouvelles images, il suffit d'ajouter des dossiers : le script les prend tous en compte et vérifie leur format avant tout appel.

```
dataset/
  salon-canape-jaune/
    case.json
    frames/00.jpg … 07.jpg
```

## Disponible aujourd'hui (25/11/2026)

| Cas | Pièce | Situations | Images | Source | Référence |
| --- | --- | --- | --- | --- | --- |
| `salon-canape-jaune` | Salon | objet difficile (taille du canapé) | 8 | 1 photo réelle (CC BY 2.0) en panoramique | provisoire |
| `chambre-lits-simples` | Chambre | partiellement visible, ambigu | 8 | 1 photo réelle (CC0) en panoramique | provisoire |
| `chambre-encombree` | Bureau-bibliothèque | encombré, partiellement visible, ambigu | 8 | 1 photo réelle (CC BY-SA 4.0) en panoramique | provisoire |

**Total : 24 images, issues de 3 prises de vue réelles.** Les photos d'origine et leurs licences sont dans `../images/SOURCES.md`.

## Ce qu'il faut fournir pour un benchmark représentatif

Il faut au moins **12 pièces**, soit environ **96 images** (8 par pièce, comme en production). Il manque donc au minimum **9 pièces filmées** :

| À filmer | Nombre | Pour couvrir |
| --- | --- | --- |
| Cuisine | 2 | cuisine ; électroménager, tables, chaises |
| Salle de bain | 1 | salle de bain ; meubles bas, colonnes, lave-linge |
| Garage ou cave | 2 | garage/cave ; vélos, établis, cartons, outillage, objets empilés |
| Salon | 1 | 2ᵉ salon |
| Chambre | 1 | 2ᵉ chambre |
| Au choix (entrée, bureau, chambre d'enfant…) | 2 | pour atteindre 12 |

Dans ces 9 pièces, il faut aussi :
- **au moins 2 pièces encombrées** (cartons, objets au sol), pour atteindre 3 ;
- **au moins 2 pièces avec des meubles partiellement cachés** (chaise derrière une table, meuble derrière une porte), pour atteindre 4 ;
- **au moins 3 pièces où le même meuble est filmé sous plusieurs angles** (en faisant le tour de la pièce). Seule une vraie vidéo convient : les 3 cas actuels n'en ont pas ;
- de préférence **1 pièce peu éclairée**.

Pour des chiffres plus fiables, viser ensuite 20 pièces (≈ 160 images).

### Comment filmer

- Les vidéos doivent venir de **votre logement ou de volontaires** qui ont donné leur accord écrit. **Jamais de vidéos de clients** : la politique de confidentialité exclut leur réutilisation.
- Filmez au téléphone, comme un client : **20 à 40 secondes par pièce**, en marchant lentement le long des murs, sans zoom brusque. Faites passer chaque meuble au moins une fois dans le champ, et les gros meubles sous deux angles.
- Évitez les personnes, les visages, les papiers lisibles et les écrans allumés.
- Format MP4 ou MOV, tel que le téléphone l'enregistre.
- Si vous n'avez que des photos : 4 à 8 photos JPEG par pièce, d'au moins 1 280 pixels de large, prises de plusieurs endroits.

### L'inventaire de référence (le plus important)

Pour chaque pièce, notez **à la main, sur place**, la liste des objets à déménager. Un simple tableau ou un texte suffit : je le convertis au bon format. Indiquez :
1. chaque meuble ou objet à déménager et sa **quantité exacte** (« 4 chaises », « 1 canapé 3 places convertible ») ;
2. les meubles **en partie cachés** sur la vidéo ;
3. les objets **difficiles** (nature ou taille ambiguë) ;
4. les petits objets dont la présence importe peu (facultatifs) ;
5. si possible, les **dimensions** des meubles inhabituels (largeur × profondeur × hauteur) ;
6. votre nom et la date de vérification : la référence passe alors en « validée ».

Ignorez les éléments fixes (cuisine équipée, placards muraux, radiateurs, luminaires au plafond) et les effets personnels.

### Où déposer les fichiers

Créez `dataset/<nom-de-la-piece>/video.mp4` et une fiche `case.json` à partir de `MODELE-case.json`, ou envoyez-moi simplement les vidéos et les inventaires. Ensuite, le script `../prepare-frames.e2e.cjs` fait passer chaque vidéo par le vrai parcours client et remplit `frames/`. Il faut pour cela Supabase local et l'application lancée **sans** `AI_PROVIDER` : la préparation ne déclenche jamais d'analyse IA.

## Format de `case.json`

Voir `MODELE-case.json` et le schéma commenté dans `src/lib/ai/benchmark/dataset.ts`.

| Champ | Rôle |
| --- | --- |
| `id` | nom du dossier (minuscules, chiffres, tirets) |
| `room_label` | nom de la pièce tel qu'un client le saisirait (envoyé au modèle) |
| `room_type` | `salon`, `chambre`, `cuisine`, `salle-de-bain`, `garage-cave`, `bureau`, `entree`, `autre` |
| `situations` | `encombre`, `partiellement-visible`, `multi-angles`, `objets-ambigus`, `faible-luminosite` |
| `source` | type (`video-reelle`, `photos-reelles`, `photo-panoramique`), auteur, licence, accord des occupants |
| `frames` | images envoyées, dans l'ordre (20 au maximum) |
| `reference.items` | `key` (identifiant du catalogue), `quantity`, `alternatives`, `optional`, `partial`, `difficult`, `volume_m3`, `views`, `comment` |
| `reference.status` | `provisoire` ou `validee` (avec `validated_by` et `validated_at`) |

Les identifiants du catalogue se trouvent dans `data/catalog/catalog.json` (champ `id`).
