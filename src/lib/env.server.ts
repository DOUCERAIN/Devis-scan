import "server-only";

/**
 * Secrets côté serveur uniquement. Ne JAMAIS préfixer par NEXT_PUBLIC_.
 * SUPABASE_SECRET_KEY contourne les règles RLS : à n'utiliser que pour les
 * tâches système (purge des vidéos, URL d'envoi signées du parcours client).
 */
export function supabaseSecretKey(): string | null {
  const key = process.env.SUPABASE_SECRET_KEY;
  return key && key.length >= 20 ? key : null;
}

/** Secret partagé avec le planificateur (Vercel Cron) pour les tâches automatiques. */
export function cronSecret(): string | null {
  const secret = process.env.CRON_SECRET;
  return secret && secret.length >= 16 ? secret : null;
}
