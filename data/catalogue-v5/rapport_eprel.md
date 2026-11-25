# EPREL — étude, conditions d'accès et démarches à effectuer

Étude du 27/11/2026, faite **uniquement à partir des sources officielles de la Commission européenne** accessibles sans compte : site public EPREL (https://eprel.ec.europa.eu), ses textes officiels (fichiers de traduction anglais publiés par le site, copie dans `cache/eprel/`) et le portail https://energy-efficient-products.ec.europa.eu. Aucun compte créé, aucune clé demandée, aucun document signé, aucune adresse interne du site utilisée pour télécharger des données.

## 1. Ce que dit officiellement la Commission

| Question | Réponse constatée | Source |
| --- | --- | --- |
| Existe-t-il une API ? | Oui : « EPREL Public API represents a collection of web services providing programmatic access to the public data of models registered in the EPREL Database. » | page « Request Public API Key » du site EPREL |
| Une clé est-elle obligatoire ? | **Oui** : « An API key is required when calling the Public API for searching and retrieving models. » Vérifié : une requête de recherche sans clé répond « Forbidden » | même page ; essai du 26/11/2026 |
| Comment obtenir la clé ? | 3 étapes : (1) remplir le formulaire en ligne et télécharger la « déclaration EPREL » ; (2) la **sceller électroniquement ou la signer numériquement** ; (3) la renvoyer (dépôt du PDF par le lien reçu par e-mail, 2 Mo maximum). La clé est envoyée à l'adresse e-mail indiquée après validation | page « Request Public API Key » |
| Qui peut demander ? | une **organisation** (« any organisation acting as a legal entity ») ou un **particulier** (« any person acting as a natural entity ») | infobulles du formulaire |
| Quelle signature ? | **Contradiction dans les textes officiels** : les infobulles exigent un **cachet électronique qualifié** de l'organisation (ou une signature électronique qualifiée pour un particulier) ; la note de l'étape 2 précise qu'une signature numérique « simple » suffit et que les signatures « avancées » ou « qualifiées » ne sont « pas requises mais également acceptées ». À clarifier avec le support avant de payer un certificat | infobulles et note de l'étape 2 |
| Informations demandées | type de demandeur (organisation / particulier), nom de l'organisation, **représentant légal** (prénom, nom), demandeur (prénom, nom), adresse e-mail de contact, **usage des données** (texte libre), nom de l'application, adresse web de l'application (en https), description de l'application, acceptation des **conditions générales** et de la **déclaration de confidentialité** de l'API | formulaire |
| Documentation de l'API | sur le wiki de la Commission (`webgate.ec.europa.eu/fpfis/wikis/x/PYbLJ`) : **réservée aux comptes EU Login**, non lisible anonymement. Les limites de fréquence, la pagination et les noms exacts des champs ne sont donc **pas vérifiés** | lien « Public API documentation » du site |
| Conditions de réutilisation | le site renvoie à un document « Public API Terms and Conditions » hébergé sur ec.europa.eu ; son adresse complète est construite par le site et **n'a pas pu être lue** depuis l'environnement. Les conditions commerciales, l'attribution et la conservation **restent à vérifier** au moment de la demande | lien du formulaire |
| Avertissement sur les données | « The information displayed in this database … has been provided directly by the suppliers, who are solely responsible for its accuracy. » | pied de page du site |
| Export sans clé | le site public permet à une personne d'**exporter en CSV** le résultat d'une recherche (1 000 lignes au maximum) et propose un bouton de téléchargement de « l'ensemble des enregistrements ». C'est un usage manuel prévu par le site ; le contenu exact de l'export (présence des dimensions) et ses conditions de réutilisation n'ont pas été vérifiés | textes du site |

Indications de tiers, **non officielles** (Zenodo, licences CC BY 4.0) : un auteur affirme que la partie publique d'EPREL est réutilisable sous CC BY 4.0 ; un autre écrit que « les conditions EPREL exigent que les copies conservées soient tenues à jour ». À confirmer par la lecture des conditions officielles ; si c'est exact, Devis Scan devra **rafraîchir régulièrement** les données plutôt que les figer.

## 2. Dimensions réellement publiées (libellés officiels des fiches)

| Groupe EPREL | Champ | Unité | Utilité |
| --- | --- | --- | --- |
| Réfrigérateurs, congélateurs, caves à vin (2019) | « Overall dimensions (Height x Width x Depth) » | mm | **oui** : réfrigérateurs américains, combinés, table top, congélateurs, caves à vin |
| Lave-vaisselle (2019) | « Overall dimensions (Height x Width x Depth) » | cm | **oui** |
| Lave-linge (2019) | « Overall dimensions (Height x Width x Depth) » | cm | oui (déjà couvert par ENERGY STAR) |
| Lave-linge séchants (2019) | « Overall dimensions (Height x Width x Depth) » | cm | oui |
| Sèche-linge (2023) | « Overall dimensions (Height x Width x Depth) » | cm | oui |
| Écrans électroniques (téléviseurs) | diagonale, surface visible, résolution — **aucune dimension extérieure** | — | **non** : EPREL ne résoudra pas les téléviseurs |
| Fours | aucun champ de dimension trouvé | — | non vérifié |

« Overall dimensions » = dimensions **hors tout de l'appareil** (ni colis, ni niche d'encastrement). Les appareils encastrables seront signalés ; leurs dimensions ne seront jamais prises pour celles d'un meuble.

## 3. Gain attendu (estimation, pas un résultat)

Sous-catégories prioritaires qui passeraient à trois dimensions : `ELM-REF-US`, `ELM-REF-COMBI`, `ELM-REF-TOP`, `ELM-CONG`, `ELM-CAVE`, `ELM-LV` (6), soit environ **138 / 171 (80,7 %)**. Correction de la v4 : les téléviseurs `INF-TV-55` et `INF-TV-75` ne seraient **pas** couverts (pas de dimensions extérieures dans EPREL). Bénéfice supplémentaire : des modèles **européens**, alors que ENERGY STAR ne couvre que le marché nord-américain.

## 4. Intégration préparée (inactive)

- `scripts/catalogue_v5/telecharger_eprel.py` : refuse de s'exécuter sans la variable `EPREL_API_KEY` ; enregistre les réponses brutes dans `cache/eprel/<groupe>/` (non versionné) avec une pause entre requêtes. Adresse, en-tête de clé et pagination à confirmer avec la documentation officielle.
- `scripts/catalogue_v5/sources_eprel.py` : lit ces fichiers s'ils existent ; dimensions hors tout seulement, mm → cm, aucune complétion ; **niveau de droits 3** (exclu des statistiques) tant que `EPREL_CONDITIONS_VERIFIEES=1` n'est pas positionné après lecture et validation des conditions par vous.
- Mise à jour : prévoir un rafraîchissement périodique (mensuel) si les conditions l'exigent.

## 5. Démarches à effectuer par vous (rien n'a été fait à votre place)

1. **Choisir le demandeur** : l'organisation qui portera Devis Scan (raison sociale, représentant légal) ou vous-même en tant que particulier. « Devis Scan » étant un nom de travail, l'organisation doit être l'entité juridique réelle.
2. **Préparer l'adresse de l'application** en https : le domaine définitif n'est pas encore choisi (phase 6). Une adresse provisoire est possible ; à préciser dans la description.
3. **Lire les conditions générales** et la déclaration de confidentialité de l'API (liens du formulaire) avant d'accepter. Vérifier en particulier : usage commercial, mention de la source, obligation de mise à jour, conservation des données.
4. **Remplir le formulaire** : https://eprel.ec.europa.eu/screen/requestpublicapikey. Proposition de texte pour « Use of data » : *« Devis Scan est un logiciel destiné aux entreprises de déménagement. Les dimensions hors tout (hauteur, largeur, profondeur) des réfrigérateurs, congélateurs, caves à vin, lave-linge, sèche-linge et lave-vaisselle servent à estimer le volume occupé par ces appareils lors d'un déménagement. Les données sont agrégées par type d'appareil (médianes) ; la source EPREL est citée. »* (à traduire en anglais si le formulaire l'exige).
5. **Signer la déclaration EPREL** téléchargée : cachet électronique de l'organisation ou signature numérique. Comme les textes officiels se contredisent sur le niveau exigé (qualifié ou simple), il vaut mieux poser la question au support **avant** d'acheter un certificat qualifié : ENER-EPREL-HELPDESK@ec.europa.eu (adresse indiquée sur le portail officiel). C'est à vous de le contacter.
6. **Déposer le PDF signé** par le lien reçu par e-mail. À réception de la clé, me la transmettre **uniquement** par une variable d'environnement de l'environnement cloud (jamais dans la conversation), puis me demander d'exécuter le téléchargement.

Coût : la demande est gratuite. Un cachet ou une signature **qualifiés** peuvent être payants chez un prestataire de confiance ; ne rien acheter avant la réponse du support.
