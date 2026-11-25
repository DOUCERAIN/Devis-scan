# Environnement de test en ligne (prévisualisation)

Mis en place le 25/11/2026. **Aucune donnée réelle de client.** Production Vercel non utilisée.

| Élément | Valeur |
| --- | --- |
| Base | Supabase `devis-scan-dev` (Paris, `eu-west-3`) : les 16 migrations du dépôt appliquées telles quelles, historique des versions conforme au dépôt |
| Site | Vercel, projet `devis-scan`, environnement **Preview** de la branche `claude/trusting-wozniak-28f6ok` : https://devis-scan-git-claude-trusting-wozniak-28f6ok-mattis11.vercel.app (adresse stable, mise à jour à chaque envoi sur la branche) |
| Variables (Preview, branche uniquement) | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_SITE_URL`, `SUPABASE_SECRET_KEY` (clé dédiée `vercel_preview_test`, type *Sensitive*, révocable dans Supabase → API Keys) |
| Non définies volontairement | `AI_PROVIDER`, `AI_MODEL`, clé Anthropic : **aucune analyse IA, aucune dépense** (les demandes envoyées passent « À vérifier », analyse « non configurée ») ; `CRON_SECRET` (Vercel n'exécute les tâches planifiées qu'en Production) |
| Authentification | Site URL et Redirect URLs = adresse de la prévisualisation ; confirmation de l'e-mail obligatoire ; mot de passe de 8 caractères minimum ; e-mails par le service intégré de Supabase (2 par heure, uniquement vers les membres de l'organisation Supabase) |
| Entreprise de démonstration | « Déménagements Démo (test) », raison sociale « ENTREPRISE FICTIVE DE TEST - ne pas utiliser », SIRET fictif, grille de test (45 €/m³, minimum 350 € HT, déplacement 80 €, 1,50 €/km au-delà de 20 km, étages, portage) |
| Lien public client | https://devis-scan-git-claude-trusting-wozniak-28f6ok-mattis11.vercel.app/d/demenagements-demo-test |

## Limites connues

- Les modèles d'e-mail ne sont pas modifiables sur l'offre gratuite sans SMTP personnalisé : un lien de confirmation ouvert sur un autre appareil que celui de l'inscription affiche « Ce lien n'est pas valide », mais l'adresse est bien confirmée (il suffit de se connecter). À régler avec le service d'e-mail.
- Fonctions de l'application exécutées aux États-Unis (`iad1`, réglage par défaut de Vercel) alors que la base est à Paris : plus lent, et à revoir avant la production (RGPD, région `cdg1`).
