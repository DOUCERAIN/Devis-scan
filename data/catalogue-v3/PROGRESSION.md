# Progression — catalogue Devis Scan v3

Dernière mise à jour : 25/11/2026. Chiffres détaillés : `tableau_bord.md` (généré), `synthese.json`.

## Fait

1. **Audit de la v2** : sources (ABO CC BY 4.0, Wikidata CC0, ItemFits documentaire), 11 536 observations, 197 sous-catégories. La v2 n'est ni modifiée ni remplacée ; la v3 relit son cache.
2. **Nouvelles sources CC0** : Met (4 851 observations), Smithsonian dont Cooper Hewitt (4 964), MoMA (748), Cleveland (317). Aucune source à droits incertains ajoutée.
3. **Taxonomie étendue** : 46 familles (+16), 311 sous-catégories physiques (+114), 204 variantes de taille. Identifiants v2 conservés.
4. **Lecture des dimensions muséales** en texte libre (`dims_texte.py`, testé) : centimètres préférés aux pouces, partie « hors tout » préférée, lettres H/L/P respectées, ordre supposé signalé, jamais de complétion.
5. **Niveau de droits** (1/2/3) sur chaque observation ; seules les observations de niveau 1 entrent dans les statistiques.
6. **Indépendance** des modèles de musée jugée par auteur connu (sinon par objet) ; même modèle de designer dans plusieurs musées regroupé.
7. **Contrôle manuel** : 120 objets de musée et Wikidata vérifiés, environ 90 % bien classés ; les erreurs relevées ont été corrigées dans les règles.
8. **Livrables** : observations par famille + index, produits, catalogue CSV/JSON, correspondance des 134 références, rapports, tableau de bord.

## Chiffres clés (v2 → v3)

| | v2 | v3 |
| --- | ---: | ---: |
| Observations | 11 536 | 23 109 |
| Modèles indépendants | 6 701 | 17 792 |
| dont utilisables | 3 741 | 9 520 |
| Familles | 30 | 46 |
| Sous-catégories | 197 | 311 |
| Sous-catégories avec ≥ 1 modèle | 134 | 227 |
| Fiabilité élevée / moyenne | 29 / 63 | 41 / 112 |
| Références historiques améliorées | 33 / 134 | 46 / 134 |

## Objectifs de la mission : atteints ou non

| Objectif (cible indicative) | Résultat | Commentaire |
| --- | --- | --- |
| ≥ 40 familles | **46** | atteint |
| 300–400 sous-catégories réelles | **311** | atteint en nombre ; 84 n'ont encore aucun modèle mesuré (sous-catégories utiles mais non documentées par les sources ouvertes) |
| ≥ 10 000 produits indépendants | **17 792** (9 520 utilisables) | atteint ; une partie sont des objets de musée, pas des produits du commerce |
| ≥ 15 000 observations | **23 109** | atteint |
| ≥ 80 % des sous-catégories prioritaires avec dimensions complètes | **130 / 171, soit 76 %** | **non atteint** : il manque surtout du gros électroménager, du mobilier de salle de bain, de bureau et d'enfant, et des équipements de sport |
| 100 % de provenance | 100 % | adresse de l'objet ou de la fiche sur chaque observation |
| 100 % de statut de droits | 100 % | niveaux 1 et 2 ; aucun niveau 3 collecté |

## Limites réelles

- **Biais muséal** : les nouvelles observations sont surtout des meubles anciens, des objets de designers et des appareils historiques (radios, machines à écrire, horloges). Elles renforcent le mobilier ancien et les appareils, beaucoup moins le mobilier courant d'un logement actuel.
- **Classement des objets de musée** moins précis (≈ 90 %) que celui des fiches commerciales (≈ 94 %).
- **Mobilier courant français** : aucune enseigne collectée (droit des bases de données, conditions d'utilisation, consigne de ne contacter personne).
- **Gros électroménager** : toujours le principal manque (réfrigérateurs américains, congélateurs, caves à vin, sèche-linge sans modèle).
- **Volume géométrique ≠ volume de déménagement** : aucune conversion automatique.
- Six fichiers d'index NASM (Smithsonian) n'ont pas pu être lus ; l'API du Victoria and Albert Museum et celle de l'Art Institute of Chicago ne sont pas joignables depuis l'environnement.

## Prochaines pistes publiques (par intérêt)

1. **EPREL** (Commission européenne) : dimensions hors tout des réfrigérateurs, congélateurs, caves à vin, lave-linge, sèche-linge, lave-vaisselle. Nécessite une **clé d'API gratuite** demandée au nom de Devis Scan : à autoriser par le porteur du projet (aucune demande faite).
2. **Art Institute of Chicago** et **Victoria and Albert Museum** (CC0 / données ouvertes) : nécessitent l'ouverture des hôtes `api.artic.edu` et `api.vam.ac.uk` dans l'environnement (à autoriser).
3. **Rijksmuseum, Nationalmuseum (Suède), Statens Museum for Kunst, Europeana** (métadonnées CC0) : mobilier européen ancien, à étudier.
4. **Wikidata** : nouvelles classes (électroménager, instruments, appareils) avec des requêtes plus étroites, au rythme imposé par Wikidata.
5. **Relevés terrain des déménageurs pilotes** : seule source du volume réel de déménagement, à prévoir dans le produit.

## Non fait (volontairement)

Aucune écriture en base, aucune migration, aucune modification du moteur IA ni du parcours client, aucun appel payant, aucun compte créé, aucune entreprise contactée, aucune modification de `main` ni de la production, aucune modification des 134 références historiques.
