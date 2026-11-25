# Mise en production (Supabase + Vercel)

Étapes à réaliser une fois sur le projet Supabase `devis-scan-dev` (région Paris) puis sur Vercel. Aucune clé secrète ne doit être écrite dans le dépôt.

## 1. Appliquer le schéma sur Supabase

Au choix :

- **Avec l'outil Supabase** (sur un ordinateur avec Node.js) :
  ```bash
  npx supabase login
  npx supabase link --project-ref <identifiant-du-projet>
  npx supabase db push
  ```
- **Sans outil** : dans Supabase → *SQL Editor*, exécuter dans l'ordre le contenu de chaque fichier de `supabase/migrations/`.

> **Projets Supabase récents** : le rôle serveur (`service_role`) ne reçoit plus automatiquement de droits sur les tables créées par les migrations. La migration `20261130090200_service_role_grants.sql` les accorde explicitement ; sans elle, l'envoi des vidéos échoue (« permission denied for table room_videos »). Constaté le 25/11/2026 sur `devis-scan-dev`.

## 2. Réglages d'authentification (Supabase → Authentication)

- *URL Configuration* : **Site URL** = adresse du site (ex. `https://devis-scan.vercel.app`) ; **Redirect URLs** : ajouter `https://devis-scan.vercel.app/**` (et les adresses de prévisualisation Vercel si besoin, ex. `https://*-votre-compte.vercel.app/**`).
- *Sign In / Providers → Email* : laisser **Confirm email** activé ; longueur minimale du mot de passe : **8**.
- *Emails → SMTP* : le service d'e-mail intégré de Supabase est limité à quelques e-mails par heure. Avant d'accueillir de vrais utilisateurs, configurer un SMTP (ex. Resend, offre gratuite).
- Facultatif : les modèles d'e-mail peuvent pointer vers `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email` (inscription) et `…&type=recovery&suivant=/nouveau-mot-de-passe` (mot de passe) pour que les liens fonctionnent même ouverts dans un autre navigateur. Avec les modèles par défaut, le lien confirme bien l'adresse, mais n'ouvre la session que dans le navigateur qui a servi à l'inscription (ailleurs : page « Ce lien n'est pas valide », adresse pourtant confirmée ; il suffit de se connecter).

## 3. Variables d'environnement (Vercel → Project → Settings → Environment Variables)

| Nom | Valeur | Secret ? |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API → Project URL | non |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase → Project Settings → API Keys → clé *publishable* (`sb_publishable_…`) | non (publique par conception) |
| `NEXT_PUBLIC_SITE_URL` | `https://devis-scan.vercel.app` (adresse réelle) | non |
| `SUPABASE_SECRET_KEY` | Supabase → API Keys → clé *secret* (`sb_secret_…`) | **oui** — ne jamais la partager |
| `CRON_SECRET` | une chaîne aléatoire d'au moins 32 caractères | **oui** |

Après tout ajout ou changement de variable : *Deployments* → *Redeploy*.

## 4. Vérifications après déploiement

1. Créer un compte, confirmer l'e-mail, créer l'entreprise.
2. Saisir une demande, changer son statut, modifier les tarifs, envoyer un logo.
3. Créer un deuxième compte : il ne doit voir aucune donnée du premier.
