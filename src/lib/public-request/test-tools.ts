import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * « Nouvelle simulation » : recommencer le parcours public pour des essais, sans mélanger ces essais
 * aux demandes commerciales (les demandes créées ainsi sont marquées is_test).
 *
 * Proposée seulement :
 * - pour une entreprise de démonstration (companies.is_demo, réglable uniquement côté serveur) ;
 * - ou hors production quand DEVIS_SCAN_TEST_TOOLS=1 (poste local, prévisualisation). Jamais en
 *   production pour une entreprise réelle.
 */
export async function testToolsEnabled(companyId: string): Promise<boolean> {
  const production = process.env.VERCEL_ENV === "production";
  if (!production && process.env.DEVIS_SCAN_TEST_TOOLS === "1") return true;
  const admin = createAdminClient();
  if (!admin) return false;
  const { data } = await admin.from("companies").select("is_demo").eq("id", companyId).maybeSingle();
  return data?.is_demo === true;
}

/** Marque une demande comme simulation (clé secrète : aucune fonction publique ne le permet). */
export async function markRequestAsTest(token: string): Promise<void> {
  const hash = await sha256(token);
  const admin = createAdminClient();
  if (!admin) return;
  const { error } = await admin.from("quote_requests").update({ is_test: true }).eq("access_token_hash", hash).eq("status", "draft");
  if (error) throw error;
}

async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
