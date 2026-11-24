import { z } from "zod";

/**
 * Variables d'environnement publiques (lisibles par le navigateur).
 * La clé « publishable » de Supabase est conçue pour être publique :
 * la sécurité repose sur les règles RLS de la base.
 */
const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url({ message: "NEXT_PUBLIC_SUPABASE_URL doit être une URL" }),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(20, "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY manquante"),
  NEXT_PUBLIC_SITE_URL: z.url().optional(),
});

export type PublicEnv = z.infer<typeof publicSchema>;

let cached: PublicEnv | null = null;

/** Lit et vérifie les variables publiques. Lève une erreur explicite si elles manquent. */
export function publicEnv(): PublicEnv {
  if (cached) return cached;
  const parsed = publicSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL || undefined,
  });
  if (!parsed.success) {
    const details = parsed.error.issues.map((i) => `- ${i.path.join(".")} : ${i.message}`).join("\n");
    throw new Error(`Configuration Supabase incomplète. Renseignez les variables d'environnement :\n${details}`);
  }
  cached = parsed.data;
  return cached;
}

/** Vrai si l'application est configurée pour se connecter à Supabase. */
export function isSupabaseConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
}
