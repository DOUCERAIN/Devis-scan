# Base de données

Schéma PostgreSQL (Supabase), défini **uniquement** par les migrations de `supabase/migrations/` (appliquées dans l'ordre du nom de fichier). Ne jamais modifier la base à la main : toute évolution = nouvelle migration.

## Principe multi-entreprises

- Chaque donnée métier porte un `company_id`.
- **RLS activée sur toutes les tables** : un utilisateur n'accède qu'aux lignes des entreprises dont il est membre (`private.user_company_ids()`).
- Les tables enfants référencent la demande par la paire `(request_id, company_id)` → impossible de rattacher une donnée d'une entreprise à la demande d'une autre (contrainte d'intégrité, en plus de la RLS).
- Le changement de `company_id` d'une ligne est interdit (trigger `private.forbid_company_change`).
- Les visiteurs anonymes n'ont **aucun droit direct** sur les tables ; le parcours client passe par des fonctions contrôlées par jeton.
- Les fonctions d'aide « security definer » sont dans le schéma `private` (non exposé par l'API).

## Rôles

| Rôle | Droits |
| --- | --- |
| `owner` (propriétaire) | Tout, dont la gestion des membres. Une entreprise garde toujours au moins un propriétaire. |
| `admin` | Paramètres de l'entreprise, tarifs, logo ; suppression de données. |
| `member` (collaborateur) | Lecture des paramètres ; création et traitement des demandes. |

## Tables

| Table | Rôle | Écriture par les utilisateurs |
| --- | --- | --- |
| `profiles` | Nom et téléphone d'un utilisateur (créé automatiquement à l'inscription) | soi-même |
| `companies` | Entreprise : nom, coordonnées, SIRET/TVA, logo, couleur, conditions de devis, durée de conservation des vidéos, préfixe et compteur des numéros de demande | owner, admin (champs système protégés) |
| `company_members` | Utilisateur ↔ entreprise + rôle | owner |
| `pricing_settings` | Grille tarifaire (1 ligne / entreprise) : prix au m³, minimum, déplacement, km, étages, petit ascenseur, portage, objet lourd, TVA | owner, admin |
| `pricing_options` | Options et prestations (forfait, par m³, par objet) | owner, admin |
| `pricing_item_surcharges` | Suppléments d'objets spécifiques (piano…) | owner, admin |
| `customers` | Particuliers (sans compte) | membres |
| `quote_requests` | Demandes de devis : statut, source, date souhaitée et alternative, distance, volume estimé, notes, jeton client (hachage), numéro séquentiel | membres (suppression : owner, admin) |
| `dwellings` | Logement de départ / d'arrivée : adresse, type, surface, étage, ascenseur, portage, accès | membres |
| `rooms` | Pièces filmées (nom, type, description) | membres |
| `room_videos` | Vidéos (fichier dans `request-media`), statut, taille, durée, dimensions, version stockée (`compressed`/`original`), encodeur, source (caméra, appareil photo, galerie), caractéristiques de l'original, date de suppression prévue | serveur uniquement |
| `video_frames` | Images extraites des vidéos | serveur uniquement |
| `analysis_runs` | Analyses IA : statut, modèle, erreurs, réponse brute | serveur uniquement |
| `inventory_items` | Inventaire : nom, quantité, volume, dimensions, source (ia / client / déménageur), confiance, doublon possible (compté « à vérifier ») et ses indices (`duplicate_reason`), validation humaine, retrait | membres |
| `inventory_item_frames` | Images où un élément a été repéré | serveur uniquement |
| `quotes` | Devis (lignes, totaux HT/TVA/TTC, validité, PDF) — calcul en phase 4 | membres |
| `request_events` | Historique automatique (création, changements de statut) + notes | automatique ; notes par les membres |

Toutes les tables ont `created_at` ; les tables modifiables ont `updated_at` (trigger).

## Statuts d'une demande (`request_status`)

`draft` (client en cours) → `submitted` (nouvelle) → `analyzing` → `to_review` (à vérifier) → `quote_sent` → `accepted` / `refused` ; à tout moment `cancelled` ou `archived`.

## Fonctions exposées

| Fonction | Appelée par | Rôle |
| --- | --- | --- |
| `create_company(name)` | utilisateur connecté | Crée l'entreprise, le rôle owner, la grille et les options par défaut (1 entreprise par compte pour l'instant) |
| `create_manual_request(payload)` | membre | Saisie manuelle d'une demande (droits de l'utilisateur, RLS appliquée) |
| `get_public_company(slug)` | public | Informations publiques pour la page client |
| `create_public_request(slug, payload)` | public | Crée un brouillon et renvoie un **jeton secret** (seul son hachage SHA-256 est stocké, validité 30 jours) |
| `update_public_request` | public + jeton | Modification du brouillon (coordonnées, dates, logements champ par champ) |
| `add_public_room`, `update_public_room`, `remove_public_room` | public + jeton | Pièces du brouillon (30 max) |
| `register_public_video` | public + jeton | Réserve l'emplacement d'une vidéo avec ses métadonnées (MP4/WebM/MOV, 50 Mo, 3 par pièce, un envoi en cours par pièce) |
| `mark_video_uploaded` | serveur (clé secrète) + jeton | Confirme l'envoi après vérification du fichier et fixe la date de suppression |
| `discard_public_video` | public + jeton | Retire une vidéo (supprimer / refaire) ; le serveur efface aussitôt le fichier |
| `add_public_frames` | serveur + jeton | Enregistre les images extraites (chemins vérifiés, 12 max par vidéo) |
| `get_public_request`, `submit_public_request` | public + jeton | Résumé complet du brouillon et envoi définitif (au moins une vidéo) |
| `claim_videos_for_purge`, `mark_videos_purged` | serveur | Purge RGPD |
| `claim_abandoned_drafts`, `delete_abandoned_drafts` | serveur | Suppression des brouillons non envoyés depuis plus de 30 jours |

## Stockage

| Bucket | Accès | Chemin |
| --- | --- | --- |
| `company-assets` | lecture publique ; écriture owner/admin de l'entreprise | `{company_id}/logo-….png` |
| `request-media` | **privé** ; lecture par les membres via URL signée (10 min) ; écriture uniquement par URL d'envoi signée délivrée par le serveur | `{company_id}/{request_id}/videos/{video_id}.mp4`, `…/frames/…` |

La tâche `/api/taches/purge-videos` (Vercel Cron, chaque jour) supprime réellement les fichiers échus du stockage, puis marque les vidéos supprimées.

## Tests

- `supabase/tests/database/tenant_isolation.test.sql` : isolation entre deux entreprises (lecture, écriture, suppression, rôles, champs protégés, stockage, anonyme).
- `supabase/tests/database/public_request.test.sql` : parcours sans compte (jeton, limites, verrouillage après envoi, fonctions serveur).
- `supabase/tests/database/customer_flow.test.sql` : modification du brouillon, pièces, vidéos, images, abandons, isolation.
- Lancer : `npm run test:db` (Supabase local démarré).

## Phase 4 (migrations `20261126090000_catalog_ai_quotes.sql`, `20261126090100_furniture_catalog_data.sql`)

| Élément | Rôle |
| --- | --- |
| `catalog_sources`, `furniture_catalog` | Registre des sources et catalogue mobilier (lecture publique, aucune écriture hors migrations) |
| `inventory_items` (+ colonnes) | Référence catalogue, fourchette de volume, volume géométrique, origine du volume, visibilité, proposition d'origine de l'IA (`ai_proposal`), modification humaine |
| `inventory_item_changes` | Journal des corrections (avant/après, auteur, date, impact volume), lecture et ajout par les membres de l'entreprise |
| `analysis_runs` (+ colonnes) | Étape, pièces traitées, images, jetons, coût, `simulated` ; une seule analyse active par demande |
| `pricing_settings.configured_at`, `trip_type` | Grille enregistrée par l'entreprise (déclencheur), type de voyage |
| `companies.reserves_terms`, `liability_terms` | Mentions rédigées par l'entreprise |
| `quote_requests.selected_options`, `distance_method`, `view_token_hash` | Options du client, méthode de calcul de la distance, lien de suivi |
| `quotes` (+ colonnes) | Version, nature (estimation/devis), origine, instantanés, hypothèses, montants en centimes ; figé par `freeze_quote`, jamais supprimé |
| Fonctions publiques | `get_public_company_options`, `set_public_options`, `get_public_selected_options`, `submit_public_request` (renvoie le jeton de suivi), `get_public_quote_view`, `respond_public_quote` |

Tests : `supabase/tests/database/phase4_quotes.test.sql`.
