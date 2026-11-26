# EPREL — étude officielle et procédure d'accès

Étude du 26/11/2026, mise à jour de `data/catalogue-v5/rapport_eprel.md`. Sources : **uniquement des documents officiels de la Commission européenne** lus ce jour, copiés dans `data/catalogue-v5/cache/eprel/` (non versionné) :

| Document | Adresse | Empreinte SHA-256 |
| --- | --- | --- |
| Conditions générales de l'API (« EPREL API … Terms and Conditions », en vigueur depuis le 3 juin 2024) | `https://ec.europa.eu/assets/move-ener/eprel/EPREL%20Public/Public%20API%20Term%20and%20Conditions/API_TERMS_AND_CONDITIONS_EN.pdf` | `b30eb96b50ee5511…` |
| Déclaration de confidentialité de l'API | `…/Public%20API%20Privacy%20Statement/API_PRIVACY_STATEMENT_EN.pdf` | `4f4213c2d51e489f…` |
| Textes officiels du site (formulaire, étapes, libellés des champs) | `https://eprel.ec.europa.eu/assets/i18n/en.json` | — |

La version « FR » des deux PDF est le même fichier que la version anglaise (empreinte identique) : seul le texte anglais fait foi.

Aucun compte créé, aucune clé demandée, aucun document signé, aucune organisation contactée, aucune adresse interne du site utilisée pour télécharger des données.

## 1. Accès

| Point | Constat officiel |
| --- | --- |
| API publique | « collection of web services providing programmatic access to the public data of models registered in the EPREL Database » |
| Clé | **obligatoire** : « An API key is required when calling the Public API for searching and retrieving models ». Vérifié : sans clé, la recherche répond « Forbidden » |
| Compte EU Login | **pas nécessaire pour demander la clé** : la page `https://eprel.ec.europa.eu/screen/requestpublicapikey` est publique (aucune protection de connexion dans le site). **Nécessaire pour lire la documentation technique** de l'API (wiki de la Commission `webgate.ec.europa.eu/fpfis/wikis/x/PYbLJ`, qui redirige vers la connexion EU Login) |
| Demandeur | une organisation (« any organisation acting as a legal entity ») ou un particulier (« any person acting as a natural entity ») |
| Informations demandées | type de demandeur ; nom de l'organisation ; représentant légal (prénom, nom) ; demandeur (prénom, nom) ; adresse e-mail de contact (elle reçoit la clé et les annonces de l'API) ; usage des données ; nom, adresse https et description de l'application ; acceptation des conditions générales et de la déclaration de confidentialité |
| Déclaration | le formulaire génère une « déclaration EPREL » en PDF, à **sceller** (organisation) ou **signer** (particulier) électroniquement, puis à déposer par le lien reçu par e-mail (PDF, 2 Mo maximum) ; traitement « automatique », résultat envoyé par e-mail |
| Délai | **aucun délai officiel publié** ; la clé est envoyée « upon validation » |
| Données personnelles | nom, prénom et e-mail du représentant légal, conservés dans le système d'archivage de la Commission (ARES) tant que la clé est utilisée ; seul l'e-mail reste dans EPREL (déclaration de confidentialité) |
| Limites de fréquence, pagination, noms exacts des champs JSON | **non vérifiés** : décrits dans la documentation réservée aux comptes EU Login |
| Disponibilité | objectif de 95 % par mois, sans garantie (article 6) ; l'API peut évoluer ou être coupée |

### La contradiction sur la signature

| Texte officiel | Exigence |
| --- | --- |
| Infobulle « Organisation » du formulaire | « requires signing the EPREL Declaration with a **qualified electronic seal** of the below declared organisation » |
| Infobulle « Particulier » | « requires signing … with a **qualified electronic signature** of the below declared individual » |
| Note de l'étape 2 | « This signature or seal can be of type '**Simple**', the 'Advanced' or 'Qualified' ones are **not required** but are equally accepted » ; il faut un PDF signé numériquement, avec un certificat qui identifie la personne ou l'entreprise |
| Déclaration de confidentialité | « provided within a declaration, in the form of a **digitally signed PDF** document » |

Interprétations possibles :

1. **La note de l'étape 2 fait foi** (texte le plus détaillé, le plus récent en apparence) : une signature numérique « simple » avec certificat, au nom du représentant légal, suffit. Coût nul ou faible.
2. **Les infobulles font foi** : un cachet électronique qualifié de l'organisation est exigé (certificat qualifié eIDAS délivré par un prestataire de confiance, payant).
3. **Les deux selon le demandeur** : un particulier peut signer simplement ; une organisation doit apposer un cachet qualifié.

Question exacte à poser au support (vous seul la posez) : voir `guide_demande_eprel.md` § 3.

## 2. Conditions de réutilisation (conditions générales, articles 3 à 7)

| Sujet | Ce que disent les conditions | Conséquence pour Devis Scan |
| --- | --- | --- |
| Licence | licence mondiale, non exclusive, d'utilisation des données et de l'API | autorisé |
| Usage commercial | autorisé « dans vos usages agrégés, pour ajouter de la valeur à vos services », **sans commercialiser ni vendre les données en tant que telles** (art. 4 § 1 i, § 2 a) | médianes de dimensions par sous-catégorie dans un logiciel de devis : conforme ; ne jamais vendre ni exposer la liste brute des modèles |
| Œuvres dérivées | autorisées (art. 4 § 1 ii) | catalogue agrégé : conforme |
| Modification, agrégation | interdites seulement si elles peuvent **induire en erreur** ou nuire à l'exactitude d'EPREL (art. 4 § 2 d) | conserver la provenance, ne jamais présenter une valeur corrigée comme une donnée EPREL |
| Attribution | conserver le crédit à la Commission (services d'EPREL) quand les données sont publiées, avec les mentions et liens existants (art. 4 § 3) | mention « Données EPREL, Commission européenne » dans les attributions du catalogue |
| Approbation | interdit de suggérer un partenariat, un parrainage ou une approbation d'EPREL (art. 4 § 2 e, art. 6 § 6, art. 7 § 6) | aucune mention commerciale de ce type |
| **Stockage local** | si les données sont stockées localement, elles doivent être **tenues à jour** ; corrections, restrictions et suppressions doivent être répercutées (art. 4 § 2 f) | **rafraîchissement périodique obligatoire** (proposé : mensuel), traçable |
| Fin d'accès | l'accès peut être retiré à tout moment ; les données obtenues restent utilisables si les conditions sont respectées, sinon **suppression immédiate de toutes les copies** (art. 5 § 4) | prévoir la suppression complète des observations EPREL si nécessaire (elles sont isolées par source) |
| Qualité | données déclarées par les fournisseurs, sans garantie d'exactitude (art. 7) | contrôles de plausibilité habituels, niveau de fiabilité |
| Sécurité | interdit de contourner les limites techniques de l'API (art. 4 § 2 g) | respect des limites de fréquence |
| Droit applicable | droit de l'Union, tribunaux de Bruxelles (art. 8) | à noter pour la revue juridique |

**Avis (non juridique)** : l'usage prévu par Devis Scan (dimensions agrégées par type d'appareil pour estimer un volume, sans revente des données) correspond aux usages explicitement permis. Les points de vigilance sont la **mise à jour** des copies locales et l'**attribution**. Une relecture par un juriste est recommandée avant la mise en production.

## 3. Dimensions réellement disponibles par groupe

Libellés officiels des fiches (fichier de traduction du site). Nombre de modèles : ordre de grandeur publié par un tiers (jeu Zenodo 23343929, CC BY 4.0, modèles mis sur le marché depuis 2023 seulement) ; le nombre total est plus élevé.

| Besoin Devis Scan | Groupe EPREL | Champ | Unité | Trois dimensions extérieures ? | Modèles (≥ 2023, tiers) |
| --- | --- | --- | --- | --- | ---: |
| Réfrigérateurs américains, combinés, table top, une porte, multiportes | Household, hotel and wine refrigerators (2019) | « Overall dimensions (Height x Width x Depth) » | mm | **oui** (champ prévu ; présence sur chaque fiche à vérifier) | 5 041 (froid, tous types) |
| Congélateurs (armoire, coffre) | même groupe | idem | mm | **oui** | inclus ci-dessus |
| Caves à vin | même groupe (« wine refrigerators ») | idem | mm | **oui** | inclus ci-dessus |
| Lave-vaisselle | Dishwashers (2019) | « Overall dimensions (Height x Width x Depth) » | cm | **oui** | 3 278 |
| Lave-linge | Washing machines (2019) | « Overall dimensions (Height x Width x Depth) » | cm | oui | 4 203 |
| Lave-linge séchants | Washer-dryers (2019) | « Overall dimensions (Height x Width x Depth) » | cm | oui | 849 |
| Sèche-linge | Household tumble dryers (2023) | « Overall dimensions (Height x Width x Depth) » | cm | oui | 1 915 |
| Téléviseurs | Electronic displays | diagonale, surface visible, résolution | — | **non** : aucune dimension extérieure | 4 208 (inutilisables pour le volume) |
| Fours | Domestic ovens | aucun champ de dimension trouvé | — | non vérifié | 4 095 |
| Hottes, chauffe-eau, climatiseurs, ventilation | divers | non examinés (installations fixes, hors inventaire courant) | — | — | — |

Produit ou emballage : les fiches EPREL décrivent **l'appareil** (« overall dimensions » = hors tout) ; aucune dimension d'emballage n'est prévue par les libellés. Les appareils encastrables (« built-in ») ont leurs propres dimensions, jamais celles du meuble qui les reçoit ; le lecteur préparé ignore aussi toute clé évoquant une niche, une porte, un tambour, un écran ou un emballage.

Limites : la présence effective du champ sur chaque fiche, sa granularité (valeur unique ou séparée H / L / P) et les noms JSON exacts ne seront connus qu'avec la clé et la documentation. **Ne pas présumer que toutes les fiches ont les trois dimensions** : le lecteur conserve les fiches incomplètes comme partielles, sans jamais compléter.

## 4. Gain attendu pour le catalogue (estimation)

Six sous-catégories prioritaires passeraient à trois dimensions : `ELM-REF-US`, `ELM-REF-COMBI`, `ELM-REF-TOP`, `ELM-CONG`, `ELM-CAVE`, `ELM-LV` → environ **138 / 171 (80,7 %)**. Bénéfices supplémentaires : modèles **européens** (ENERGY STAR ne couvre que l'Amérique du Nord), et `ELM-REF-1P`, `ELM-REF-MULTI`, `ELM-CONG-COFFRE` (non prioritaires). Les téléviseurs `INF-TV-55` et `INF-TV-75` restent sans source.

## 5. Intégration préparée (inactive)

- `scripts/catalogue_v5/telecharger_eprel.py` : refuse de fonctionner sans `EPREL_API_KEY` ; enregistre les réponses brutes ; pause entre requêtes ; adresses à confirmer avec la documentation.
- `scripts/catalogue_v5/sources_eprel.py` : dimensions hors tout uniquement (clés imbriquées acceptées ; emballage, niche, porte, tambour, écran exclus ; valeur ambiguë → ignorée), mm → cm, aucune complétion ; **niveau de droits 3** tant que `EPREL_CONDITIONS_VERIFIEES=1` n'est pas positionné.
- `scripts/catalogue_v5/test_eprel.py` : 5 tests sur réponses fictives (aucune clé, aucun appel).
- Procédure d'import : `guide_demande_eprel.md` § 6.
