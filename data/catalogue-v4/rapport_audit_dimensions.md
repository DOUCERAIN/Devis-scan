# Audit des dimensions et des volumes — catalogue Devis Scan v4

Généré par `scripts/catalogue_v4/audit_dimensions.py`. Cet audit porte sur les **valeurs** (dimensions, volumes, variantes). Il est distinct du contrôle du **classement** des objets (`rapport_qualite.md`) : un objet bien classé peut avoir des dimensions fausses, et inversement.

## Périmètre

- 18 488 observations à 3 dimensions, dont 13 851 utilisées dans les statistiques.
- Répartition : commerce (ABO) : 9 387, musées et Wikidata : 7 986, électroménager (ENERGY STAR) : 986, documentaire (ItemFits) : 129.

## 1. Cohérence hauteur / largeur / profondeur

Convention : largeur = plus grande dimension horizontale, profondeur = plus petite (le volume n'en dépend pas). Contrôle : le rapport hauteur / largeur d'une observation est comparé à la médiane de sa sous-catégorie ; un écart de plus d'un facteur 3 signale une orientation suspecte (hauteur et profondeur inversées, objet couché, mesure d'une seule pièce).

- Orientation suspecte : **1 652** observations (8,9 %), dont 693 utilisées dans les statistiques — musées et Wikidata : 832, commerce (ABO) : 806, documentaire (ItemFits) : 14.
  - `ANI-PANIER` ABO — AmazonBasics Warming Pet Bed 22-Inch DF2018203M : 55.9 × 55.9 × 20.1 cm
  - `DEC-TABLEAU` ABO — Amazon Brand – Stone & Beam Classic Red, White and Blue Flag Patterns  : 1.9 × 68.6 × 53.3 cm
  - `DEC-TAPIS-PETIT` ABO — Amazon Basics - 4'X6' Plush Diamond Trellis Shag Rug, Ivory : 5.1 × 177.8 × 121.9 cm
  - `DEC-TAPIS-MOYEN` ABO — Amazon Brand – Rivet Abstract Reflections Modern Wool Area Rug, 5 x 8  : 0.3 × 243.8 × 152.4 cm
  - `ANC-CHAISE` SMITHSONIAN — chair : 53.3 × 7.6 × 7.6 cm
  - `CHA-REPAS` MOMA — Wave Chaise : 41.2 × 213.3 × 61.6 cm
  - `ANC-TABLE` WIKIDATA — table d'offrandes rectangulaire à bec rectangulaire (E 13105) : 8.5 × 49.0 × 36.0 cm
  - `MAC-ORDI-ANCIEN` MOMA — ThinkPad 701 Portable Computer : 4.5 × 24.6 × 20.0 cm
- Le volume géométrique ne dépend pas de l'orientation : ces cas faussent les **hauteurs médianes** affichées, pas les volumes.
- Correction appliquée en v4 : téléviseurs ABO dont l'épaisseur était publiée comme hauteur (axes réordonnés, valeurs inchangées, signalé dans `commentaires`).

## 2. Erreurs de conversion d'unités

- **1 138** observations portent une erreur d'unité probable (valeur multipliée ou divisée par 10 ou 2,54 retombant dans les bornes) : valeurs conservées telles quelles, jamais corrigées, exclues des statistiques — musées et Wikidata : 784, commerce (ABO) : 303, électroménager (ENERGY STAR) : 47, documentaire (ItemFits) : 4.
  - `ANC-ARMOIRE` MET — Armoire : 301.0 × 183.5 × 71.1 cm
  - `ANC-ARMOIRE` WIKIDATA — Q140269743 : None × 29.0 × 25.5 cm
  - `ANC-AUTRE` WIKIDATA — élément de mobilier baguette, Musée du Louvre AO 28428 : 7.2 × 5.9 × None cm
  - `ANC-AUTRE` WIKIDATA — Ivory Throne Leg : 34.9 × 15.7 × None cm
  - `ANC-AUTRE` WIKIDATA — Baluster Panel (one of a pair) : None × 24.8 × None cm
  - `ANC-AUTRE` WIKIDATA — Baluster Panel (one of a pair) : None × 24.8 × None cm
  - `ANC-AUTRE` WIKIDATA — Furniture element decorated with the images of Nekhbet, the vulture go : 19.3 × 41.3 × 1.7 cm
  - `ANC-AUTRE` WIKIDATA — Peana : 16.0 × 20.5 × 16.5 cm
- Limite du détecteur : c'est une hypothèse. Pour les objets de musée, beaucoup de signalements sont en réalité des objets hors normes (armoire de 3 m) ou des éléments isolés (pied, panneau) ; ils sont de toute façon exclus des statistiques.
- Conversions effectuées par Devis Scan : pouces → cm (× 2,54) pour ABO, ENERGY STAR et les musées ; mètres → cm pour Wikidata. Aucune double conversion : les musées donnant pouces et centimètres sont lus en centimètres.

## 3. Dimensions de colis confondues avec le meuble assemblé

- Discordance avec les dimensions écrites dans le nom du produit : **457** observations, exclues des statistiques.
- Meubles ABO très plats et très petits par rapport à leur sous-catégorie (dimension minimale < 35 % de la médiane et volume < 40 % de la médiane), profil typique d'un carton à plat : **230** observations, dont **59** encore utilisées dans les statistiques (à revoir à la main).
  - `ARM-2P` ABO — Movian - Armario de 2 puertas con espejo, 60 x 42 x 198 cm, blanco : 10.3 × 129.4 × 42.6 cm
  - `ARM-NC` ABO — UMI.3D Adhésif électrostatique Films pour Fenêtre pour Armoire de Port : 0.3 × 200.0 × 60.0 cm
  - `ARM-NC` ABO — AmazonBasics - Mensola da armadio a 6 ripiani, in tela rinnovata : 30.5 × 30.5 × 5.1 cm
  - `ARM-NC` ABO — AmazonBasics - Mensola per armadio a 10 ripiani (rinnovata) 1-Pack Del : 30.5 × 15.2 × 6.3 cm
  - `ARM-PORT` ABO — AmazonBasics Garment Rack, Chrome : 90.2 × 57.1 × 8.9 cm
  - `ARM-PORT` ABO — Marque Amazon - Movian - Portant mural avec étagère intégrée, 79 x 29, : 3.9 × 130.6 × 81.1 cm
  - `ARM-PORT` ABO — AmazonBasics Leaning Garment Rack, Silver : 64.0 × 34.5 × 2.2 cm
  - `ARM-PORT` ABO — AmazonBasics Leaning Garment Rack, Black : 64.0 × 34.5 × 2.2 cm
- Les sources ENERGY STAR (déclaration de certification) et muséales (objet mesuré) ne publient pas de dimensions de colis.

## 4. Valeurs aberrantes

- **236** modèles écartés des statistiques par la règle de Tukey (logarithme du volume, écart interquartile × 2, dès 8 modèles), listés dans `produits_exclus`. Sous-catégories les plus concernées :
  - `ELM-SL` Sèche-linge : 121 sur 612
  - `ANC-COIFFEUSE` Coiffeuse ou table de toilette ancienne (lowboy) : 9 sur 43
  - `DEC-TAPIS-NC` Tapis (taille non précisée) : 9 sur 72
  - `ANC-CHAISE` Chaise ancienne : 9 sur 932
  - `ANC-TABOURET` Tabouret ou repose-pieds ancien : 7 sur 132
  - `LIT-TETE` Tête de lit : 6 sur 53
  - `PRO-CHARIOT` Diable, chariot ou transpalette : 4 sur 13
  - `ANC-CONSOLE` Console ancienne : 4 sur 69
  - `CAN-NC` Canapé (nombre de places non précisé) : 4 sur 105
  - `AUD-PHONO` Phonographe, gramophone ou platine : 3 sur 144

## 5. Cohérence des volumes géométriques

- Recalcul hauteur × largeur × profondeur sur chaque observation : **0** écart (tolérance : arrondi au litre).
- Ordre minimum ≤ Q1 ≤ médiane ≤ Q3 ≤ maximum : **0** référence incohérente.
- Rapport entre le produit des dimensions médianes et le volume médian, hors de 0,67–1,5 : **8** références sur 429. Ce n'est pas une erreur : les médianes de chaque dimension ne viennent pas du même modèle. Un écart fort signale une sous-catégorie hétérogène, dont il faut lire le volume médian plutôt que les dimensions médianes :
  - `COU-CHEVALET` : rapport 0,22
  - `PRO-PRESENTOIR` : rapport 2,37
  - `DEC-TABLEAU-C` : rapport 2,09
  - `MUS-GUITARE` : rapport 1,67
  - `ARM-NC-C` : rapport 0,62
  - `CHF-PURIFICATEUR` : rapport 0,64
  - `SDB-ARMOIRE` : rapport 0,66
  - `LUM-LUSTRE-L` : rapport 1,51

## 6. Variantes de taille

- Produits d'une variante n'appartenant pas à sa sous-catégorie de base : **0**.
- Variantes mal ordonnées (compacte < standard < grande) ou qui se chevauchent : **0**.
- Limite : les variantes découpent les modèles observés en trois tiers de volume ; elles décrivent la diversité des catalogues, pas des tailles commerciales normalisées.

## 7. Contrôle manuel des dimensions (26/11/2026)

Échantillon tiré au sort (graine 2611) parmi les observations utilisées dans les statistiques : 40 fiches du commerce (ABO), 30 objets de musée ou Wikidata, 20 appareils ENERGY STAR (liste : `cache/echantillon_audit.txt`). Question posée pour chacune : les trois dimensions sont-elles plausibles pour l'objet nommé, monté (et non emballé) ?

| Groupe | Plausibles | Douteuses | Détail |
| --- | ---: | ---: | --- |
| Commerce (ABO) | 38 / 40 | 2 | chevet « Rom » : 59 cm de large pour 50 × 50 × 42 annoncés (colis ?) ; fauteuil à oreilles : profondeur 96 cm pour 81 cm de large annoncés (axes probablement inversés) |
| Musées et Wikidata | 29 / 30 | 1 | banc « Melloni » : profondeur 17,8 cm (pièce isolée ?) |
| ENERGY STAR | 20 / 20 | 0 | dimensions cohérentes ; modèles américains plus larges (69 à 86 cm) que les modèles européens (60 cm) |

Résultat : **87 / 90 dimensions plausibles (environ 97 %, intervalle de confiance à 95 % : 91 à 99 %)**. En plus, un cadre photo a son épaisseur publiée comme hauteur (orientation, volume juste). Ce taux porte sur la **plausibilité des dimensions**, pas sur le classement des objets (≈ 90 à 94 %, voir `rapport_qualite.md`) ni sur l'exactitude du volume de déménagement, qui n'est pas mesuré ici.

Ce que ce contrôle ne garantit pas : qu'une dimension plausible soit exacte (une erreur de quelques centimètres passe inaperçue) ; que le volume géométrique corresponde au volume chargé dans un camion.
