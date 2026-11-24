import "server-only";
import { createClient } from "@supabase/supabase-js";
import { publicEnv } from "@/lib/env";
import { supabaseSecretKey } from "@/lib/env.server";
import type { Database } from "./database.types";

/**
 * Client « système » qui contourne les règles RLS.
 * Réservé aux tâches serveur contrôlées (purge RGPD, URL d'envoi signées).
 * Retourne null si la clé secrète n'est pas configurée.
 */
export function createAdminClient() {
  const key = supabaseSecretKey();
  if (!key) return null;
  return createClient<Database>(publicEnv().NEXT_PUBLIC_SUPABASE_URL, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
