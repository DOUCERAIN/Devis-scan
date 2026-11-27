# Parcours client et vidéos

Le particulier ouvre le lien de son déménageur, `/d/<identifiant-de-l-entreprise>`, sans créer de compte.

## Étapes (parcours v3, 02/12/2026 — migration `20261202090000_parcours_medias_inventaire_visuel.sql`)

| Étape | Page | Contenu |
| --- | --- | --- |
| Accueil | `/d/[slug]` | Présentation aux couleurs de l'entreprise, reprise ou nouvelle demande |
| 1 Déménagement | `/demande/trajet` | Pour chaque logement : adresse (suggestions API Adresse, coordonnées recherchées côté serveur si aucune suggestion n'est choisie), type de logement, **étage obligatoire** (liste avec « Rez-de-chaussée », sous-sols, 1er à 30e), ascenseur, précisions facultatives repliées (surface, pièces, portage, accès, contraintes). Date souhaitée, **dates alternatives en nombre libre** (bouton « Ajouter une date alternative », retrait possible, 30 au plus : futures, distinctes entre elles et de la date souhaitée), dates flexibles. Crée le brouillon (sans coordonnées) |
| 2 Coordonnées | `/demande/coordonnees` | Profil **Particulier** (prénom, nom, e-mail, téléphone obligatoires) ou **Entreprise** (nom de l'entreprise obligatoire, SIRET facultatif à 14 chiffres, puis la personne à contacter). Information sur les données personnelles, accord obligatoire au traitement pour établir le devis (date enregistrée), accord facultatif aux offres commerciales (jamais coché par défaut) |
| 3 Méthode | `/demande/methode` | « Filmer ou photographier mon logement » ou « Faire mon inventaire manuellement » (changement possible tant que la demande n'est pas envoyée) |
| 4a Médias | `/demande/medias` | **Aucune pièce à créer.** Trois choix : **Filmer** (consignes : filmer lentement, montrer l'ensemble des meubles, tour complet de chaque pièce, pas de mouvements rapides ; plusieurs séquences possibles), **Importer une ou plusieurs vidéos**, **Importer des photos** (sélection multiple). Les médias choisis s'affichent avec un aperçu et peuvent être retirés avant « Valider et envoyer » ; on peut en ajouter ensuite, revoir et supprimer les médias envoyés. Tout est rangé dans une pièce technique « Mon logement » (`rooms.room_type = 'logement'`). Les anciennes adresses `/demande/pieces` et `/demande/videos` redirigent ici |
| 4b Manuel | `/demande/inventaire` | **Inventaire visuel** (voir ci-dessous). Chaque modification est affichée tout de suite et enregistrée en arrière-plan |
| 5 Récapitulatif | `/demande/recapitulatif` | Tout le dossier avec liens « Modifier », options de l'entreprise, message. Méthode manuelle : avertissement à confirmer, puis « Valider mon inventaire et recevoir mon devis » |
| — | `/devis/<jeton>` | Lien secret de suivi. Vidéo : progression réelle de l'analyse, puis **inventaire modifiable** (quantités, retraits, objets oubliés, mêmes outils que l'inventaire manuel), « Éléments à vérifier » avec réponse obligatoire, avertissement, validation → devis final immédiat. Analyse impossible : bouton « Compléter mon inventaire moi-même ». Manuel : devis final dès l'envoi. Puis PDF, acceptation ou refus, nouvelles versions et avenants. Voir `docs/devis.md` |
| — | `/demande/envoyee` | Confirmation ; le dossier n'est plus modifiable |
| — | `/demande/logements` | Ancienne étape : redirige vers l'étape 1 |

Chaque étape exige les précédentes (`reachableStep`, `src/lib/public-request/steps.ts`) : un lien direct vers une étape non accessible renvoie vers la première étape à compléter. Rien n'est perdu en revenant en arrière.

## Demandes successives depuis le même appareil (27/11/2026)

Trois états bien distincts, chacun dans son cookie httpOnly limité à `/d/<slug>` (`src/lib/public-request/session.ts`) :

| État | Cookie | Comportement |
| --- | --- | --- |
| Demande **en cours** (brouillon) | `dsr_` | Reprise depuis l'accueil (« Reprendre ma demande en cours ») si le client quitte le parcours |
| Dernière demande **envoyée** | `dsl_` | Lecture seule : « Voir ma demande » (écran de confirmation) ; ne bloque jamais une nouvelle demande |
| **Nouvelle** demande | — | Créée à l'enregistrement de l'étape 1 : nouvel identifiant, nouveau jeton, nouvelle fiche client, formulaire vierge |

- À l'envoi, la demande quitte l'état « en cours » (`markDraftSent`). Le lien public propose alors « Nouvelle demande de devis ».
- Ce bouton apparaît sur l'accueil, l'écran de confirmation et la page de suivi du devis.
- « Recommencer depuis le début » (accueil, étape 1, récapitulatif) demande une confirmation, puis repart d'un formulaire vierge.
- **Rien n'est supprimé.** Une demande envoyée reste chez le déménageur, inchangée. Un brouillon jamais envoyé suit la règle habituelle des abandons : purge après 30 jours.
- Un ancien cookie qui désignerait encore une demande envoyée est traité comme « dernière demande envoyée » (`loadContext`, `load.ts`).

**Nouvelle simulation** : nouvelle demande marquée `quote_requests.is_test` (migration `20261203090000_nouvelles_demandes.sql`), affichée « Simulation » dans l'espace pro et exclue des compteurs du tableau de bord.
- Elle n'est proposée que pour une entreprise de démonstration (`companies.is_demo`, réglable seulement côté serveur), ou hors production avec `DEVIS_SCAN_TEST_TOOLS=1` (`src/lib/public-request/test-tools.ts`). Jamais en production pour une entreprise réelle.
- Le marquage est posé par le serveur avec la clé secrète ; aucune fonction publique ne le permet.

## Inventaire visuel (parcours v3)

Utilisé pour l'inventaire manuel et pour corriger l'inventaire de l'analyse (`/devis/<jeton>`) : `src/components/customer/VisualInventory.tsx`.

1. **Cartons d'abord** : « Commençons par estimer vos cartons », nombre de cartons **supplémentaires** obligatoire (0 accepté, champ vide au départ, exemple « 10 » en gris). Les cartons déjà repérés par l'analyse sont annoncés comme déjà comptés. Le nombre est enregistré dans `quote_requests.extra_boxes` et reporté en une ligne « Carton standard » (volume du catalogue, 0,10 m³, inchangé) dans la pièce « Cartons ». La base refuse l'envoi et la validation tant que l'étape n'est pas remplie.
2. **Une pièce par onglet** : Salon, Cuisine, Chambre, Salle de bain, Bureau, Entrée / couloir, Garage / cave, Autre pièce, et « Ajouter une pièce » (Chambre 2…, `room_type = 'inv:<catégorie>:<n>'`). Les objets de l'analyse sont rangés selon leur catégorie du catalogue (`src/lib/inventory/rooms.ts`).
3. **Illustration interactive** par pièce (SVG au trait, mode sombre compris) : chaque meuble est une zone cliquable distincte reliée à un identifiant exact de `furniture_catalog` (`src/lib/inventory/scenes.ts`, dessins dans `src/components/customer/illustrations/`). Un appui ajoute un exemplaire ; la quantité s'affiche sur le meuble. Objet sans volume de référence : taille approximative demandée (règle existante).
4. Sous l'illustration : liste des objets de la pièce (+, −, saisie directe de la quantité, suppression), liste déroulante de tous les objets de la catégorie, recherche dans tout le catalogue, **objet non référencé** (nom, quantité, taille ou dimensions, description facultative) affiché « Objet à vérifier ».

**Quantités** : un appui sur le nombre permet de le remplacer au clavier (chiffres seulement ; champ vide toléré pendant la saisie et rétabli à la sortie ; 0 retire l'objet).

**Fluidité** : les modifications sont appliquées immédiatement à l'écran puis envoyées une par une en arrière-plan (`SyncEngine`, `src/lib/inventory/sync-queue.ts`) ; les appuis rapides sont regroupés ; l'état renvoyé par la base fait foi une fois tout enregistré. Coupure réseau : trois nouvelles tentatives puis message « Connexion perdue », les modifications restent en attente et repartent au retour de la connexion. Refus de la base : l'écran se recale sur l'état enregistré avec un message. Les actions serveur ne recalculent plus la page (`revalidatePath` supprimé).

## Analyse de l'ensemble du logement

Les images de toutes les vidéos et photos de « Mon logement » sont prises dans l'ordre de prise de vue, 60 au plus, analysées par lots de 20 (`src/lib/analysis/batches.ts`). Les résultats des lots sont réunis comme une seule pièce : un meuble repéré dans deux lots est signalé « doublon possible » (jamais retiré), puis tranché par le client (« Éléments à vérifier ») et le déménageur. Une photo (JPEG réduit à 1 600 px dans le navigateur, `src/lib/video/photo.ts`) est sa propre image d'analyse.

## Prix affichés au client

Le client voit les prestations et options retenues, leur description et le **prix total** ; jamais le prix d'une option ni le montant d'une ligne. La séparation est faite en base : `get_public_quote_view` ne renvoie que libellé et détail sans prix (`private.client_line`), `get_public_company_options` ne renvoie plus le prix ; le PDF client est construit à partir de ces seules données. Le déménageur garde le détail chiffré. Les tarifs ne sont pas modifiés. **À faire valider juridiquement** (information du consommateur sur le prix des prestations).

## Volume des objets saisis par le client

Le client ne donne jamais de volume. Le volume est calculé en base (`private.customer_item_volume`) et sa justification est enregistrée (`inventory_items.volume_note`, affichée au déménageur) :

1. objet du catalogue avec volume de déménagement : ce volume (`volume_source = catalog`) ;
2. dimensions indiquées : largeur × profondeur × hauteur × coefficient de manutention (1,1 par défaut, celui de la catégorie de l'objet s'il est connu) (`dimensions`) ;
3. sinon, taille approximative obligatoire : volume du catalogue d'un objet comparable — petit = « Carton standard », moyen = « Fauteuil », grand = « Armoire 2 portes », très grand = « Canapé 3 places » (`comparable`).

Sans dimensions ni taille, l'ajout est refusé : aucun volume arbitraire. Le devis mentionne les objets estimés par taille approximative ou par dimensions (« à confirmer par le déménageur »). Les objets du client sont marqués « Ajouté par le client » côté pro, avec leur commentaire.

Après l'analyse, chaque ajout, modification ou retrait du client est historisé (`inventory_item_changes`, acteur `customer`) ; l'inventaire initial de l'IA reste consultable (`ai_proposal`). Un retrait marque l'objet retiré sans l'effacer.

## Sécurité du parcours

- L'entreprise est toujours déduite du lien côté serveur ; le visiteur ne transmet jamais d'identifiant d'entreprise.
- La demande est identifiée par un **jeton secret** (32 octets aléatoires) remis à la création, stocké dans un **cookie httpOnly** limité au chemin `/d/<slug>` (30 jours). Seul son hachage SHA-256 est en base. Aucune URL ne contient d'identifiant de demande.
- Toutes les opérations passent par des fonctions SQL qui vérifient le jeton, l'état (brouillon) et des limites (30 pièces, 3 vidéos par pièce, 50 Mo, 12 images par vidéo). Les tables restent fermées aux visiteurs.
- Après l'envoi, toute modification est refusée (statut `submitted`). Un double envoi est sans effet. L'inventaire n'est modifiable par le client que dans deux états : brouillon en méthode manuelle, ou inventaire de l'analyse en attente de sa validation (`awaiting_customer`) ; jamais après la validation.
- L'envoi exige en base : coordonnées avec accord au traitement, date souhaitée, étages des deux logements, et une vidéo (méthode vidéo) ou un inventaire non vide (méthode manuelle).
- Session expirée ou jeton invalide : retour à l'étape 1 avec un message, sans rien révéler.

## Vidéos

### Capture
1. **Caméra intégrée** (`getUserMedia` + `MediaRecorder`), caméra arrière, 720p visé, **sans le son**, 2 minutes maximum, consignes affichées pendant le tournage (pièce entière, mouvement lent, plusieurs angles, objets volumineux, rangements).
2. **Repli** si la caméra est refusée, absente ou non prise en charge : appareil photo natif du téléphone (`<input capture>`), ou **vidéo existante de la galerie**.
3. Le client revoit sa vidéo, puis l'utilise, la refait ou la supprime.

### Compression (dans le navigateur)
Solutions comparées :

| Solution | Verdict |
| --- | --- |
| **Mediabunny** (WebCodecs, encodeur matériel du navigateur) | **Retenue** : rapide, léger, MP4/H.264 ou WebM/VP9 selon l'appareil |
| ffmpeg.wasm | Écartée : ~30 Mo à télécharger par client, très lent sur téléphone |
| Réenregistrement via `MediaRecorder` | Écarté : temps réel, qualité moindre |

Réglages : petit côté ramené à 720 px, 30 images/s au plus, ~2 Mbit/s, son supprimé. Si l'appareil ne sait pas encoder (anciens navigateurs), **la vidéo d'origine est envoyée** si elle fait 50 Mo au plus ; sinon un message demande une séquence plus courte. Si la compression n'apporte rien, l'original est conservé.

**L'original n'est jamais détruit** : il reste sur le téléphone. La base enregistre quelle version est stockée (`processing` : `compressed` ou `original`), l'encodeur, la source (caméra, appareil photo, galerie) et les caractéristiques de l'original (taille, format, dimensions, durée).

Mesure réelle (test automatisé) : vidéo 1920×1080 de 9,5 Mo → 1280×720, 2,5 Mo. Le gain dépend du contenu : une vidéo de bruit aléatoire de 57 Mo n'a été réduite qu'à 39 Mo.

### Images extraites
24 instants échantillonnés, puis : élimination des images trop sombres/claires et floues (variance du laplacien), puis sélection par netteté décroissante en écartant les quasi-doublons (différence de miniatures). Jusqu'à 8 images JPEG (1 280 px), au moins 3 quand la vidéo le permet. Décodage par Mediabunny, repli sur le lecteur vidéo du navigateur.

### Envoi
- Le serveur réserve l'emplacement (`register_public_video`) et délivre une **autorisation d'envoi signée, liée à ce seul chemin** (2 h).
- **Envoi reprenable réel** (protocole TUS de Supabase Storage, `upload/resumable/sign`) : morceaux de 6 Mo, progression affichée, reprise automatique après une coupure (jusqu'à 4 fois), puis bouton « Reprendre l'envoi » qui repart de la position déjà reçue. Vérifié en test (coupure simulée). La reprise fonctionne tant que la page reste ouverte ; après fermeture de la page, l'envoi recommence depuis le début.
- Le serveur vérifie ensuite le fichier réellement reçu : présence, taille (50 Mo max) et **format réel** (premiers octets). Fichier non conforme : effacé et refusé.
- Les images extraites sont envoyées avec des URL signées générées par le serveur, puis enregistrées après vérification de leur présence.
- Supprimer ou refaire une vidéo efface immédiatement le fichier et ses images.

### Stockage et accès
Bucket privé `request-media`. Le déménageur lit vidéos et images par des liens temporaires (10 min) créés avec sa session : seules les entreprises propriétaires y ont accès. Le particulier peut revoir sa propre vidéo par un lien temporaire délivré après vérification de son jeton.

## Abandons et conservation
- Un brouillon non envoyé n'apparaît pas chez le déménageur.
- La tâche quotidienne `/api/taches/purge-videos` supprime les vidéos échues (durée de conservation de l'entreprise) et les **brouillons abandonnés depuis plus de 30 jours, fichiers compris**.

## Compatibilité constatée
Testé automatiquement dans **Chromium** (moteur de Chrome) en émulation **Android (Pixel 7)** et **iPhone SE** (taille d'écran uniquement), avec caméra simulée. **Non testé sur de vrais appareils, ni sur Safari iOS** (moteur WebKit indisponible dans l'environnement de test). Points prévus pour Safari : enregistrement MP4 par `MediaRecorder` (iOS 14.3+), WebCodecs (iOS 16.4+, sinon envoi de l'original), repli sur l'appareil photo natif. À valider sur de vrais téléphones avant la commercialisation.

## API Adresse
Suggestions via `https://data.geopf.fr/geocodage/search` (Base Adresse Nationale servie par l'IGN), appelée depuis le navigateur du client. Si le service ne répond pas, la saisie manuelle du code postal et de la ville reste possible. Dans les tests automatisés, l'API est remplacée par une réponse d'exemple au format réel (le service n'est pas joignable depuis l'environnement de test).
