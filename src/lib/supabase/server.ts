import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { publicEnv } from "@/lib/env";
import type { Database } from "./database.types";

/**
 * Client Supabase lié à l'utilisateur de la requête (cookies de session).
 * Toutes les requêtes passent par les règles RLS. Un nouveau client par requête.
 */
export async function createClient() {
  // Lire les cookies en premier : la page devient dynamique (jamais calculée à la construction).
  const cookieStore = await cookies();
  const env = publicEnv();
  return createServerClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) cookieStore.set(name, value, options);
        } catch {
          // Appelé depuis un composant serveur : le proxy (src/proxy.ts) se charge
          // de rafraîchir la session et d'écrire les cookies.
        }
      },
    },
  });
}

export type ServerSupabase = Awaited<ReturnType<typeof createClient>>;
