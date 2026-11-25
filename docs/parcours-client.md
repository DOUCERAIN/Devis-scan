# Parcours client et vidéos (phase 3)

Le particulier ouvre le lien de son déménageur, `/d/<identifiant-de-l-entreprise>`, sans créer de compte.

## Étapes

| Étape | Page | Contenu |
| --- | --- | --- |
| Accueil | `/d/[slug]` | Présentation aux couleurs de l'entreprise (logo, couleur, téléphone, e-mail), reprise ou nouvelle demande |
| 1 | `/demande/trajet` | Adresses de départ et d'arrivée (suggestions API Adresse), date souhaitée, date alternative, dates flexibles, coordonnées, accord RGPD. Crée le brouillon |
| 2 | `/demande/logements` | Pour chaque logement : type, surface, nombre de pièces, étage, ascenseur, portage, difficultés d'accès, contraintes |
| 3 | `/demande/pieces` | Pièces (raccourcis Salon, Cuisine…, nom libre, description) : ajout, modification, suppression |
| 4 | `/demande/videos` | Une vidéo par pièce : tournage, revue, compression, images, envoi |
| 5 | `/demande/recapitulatif` | Tout le dossier, liens « Modifier », pièces sans vidéo signalées, options proposées par l'entreprise, message final, envoi définitif |
| — | `/devis/<jeton>` | Après l'envoi : lien secret de suivi. On y trouve la progression de l'analyse, puis l'**inventaire à valider** (rubrique « Éléments à vérifier » avec une réponse obligatoire, avertissement à confirmer), puis le devis final (PDF, acceptation ou refus) et, s'il y en a, les nouvelles versions ou avenants avec leurs différences. Voir `docs/devis.md` |
| — | `/demande/envoyee` | Confirmation (retour sur l'appareil après envoi) ; le dossier n'est plus modifiable |

La barre de progression permet de revenir aux étapes déjà remplies ; chaque étape est enregistrée en base, rien n'est perdu en revenant en arrière.

## Sécurité du parcours

- L'entreprise est toujours déduite du lien côté serveur ; le visiteur ne transmet jamais d'identifiant d'entreprise.
- La demande est identifiée par un **jeton secret** (32 octets aléatoires) remis à la création, stocké dans un **cookie httpOnly** limité au chemin `/d/<slug>` (30 jours). Seul son hachage SHA-256 est en base. Aucune URL ne contient d'identifiant de demande.
- Toutes les opérations passent par des fonctions SQL qui vérifient le jeton, l'état (brouillon) et des limites (30 pièces, 3 vidéos par pièce, 50 Mo, 12 images par vidéo). Les tables restent fermées aux visiteurs.
- Après l'envoi, toute modification est refusée (statut `submitted`). Un double envoi est sans effet.
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
