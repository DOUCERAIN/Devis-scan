import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { generateQuote, hasLegalIdentity } from "@/lib/quotes/generate";

type Client = SupabaseClient<Database>;

export type FinalQuoteOutcome =
  | { status: "sent"; version: number }
  | { status: "pending_mover"; reason: string };

/**
 * Devis FINAL établi dès que le client a validé son inventaire (décisions sur les doublons comprises) :
 * inventaire et volume recalculés, prix calculé avec la grille de l'entreprise, version figée transmise
 * immédiatement au client, qui peut l'accepter sans attendre la vérification du déménageur.
 *
 * Seuls des empêchements objectifs retardent ce devis (le déménageur est alors prévenu sur sa fiche) :
 * grille non enregistrée, identité légale incomplète (raison sociale, SIRET, adresse), prix impossible
 * à calculer (distance ou volume manquants).
 */
export async function issueFinalQuote(admin: Client, requestId: string): Promise<FinalQuoteOutcome> {
  const { data: request } = await admin.from("quote_requests").select("company_id, companies(legal_name, siret, address_line1, postal_code, city)").eq("id", requestId).single();
  const company = request?.companies;
  if (!request || !company) return { status: "pending_mover", reason: "Entreprise introuvable." };
  if (!hasLegalIdentity(company)) return { status: "pending_mover", reason: "Identité légale de l'entreprise incomplète (raison sociale, SIRET, adresse)." };
  const outcome = await generateQuote(admin, requestId, { origin: "customer_validation", send: true });
  if (outcome.status === "created") return { status: "sent", version: outcome.version };
  if (outcome.status === "pricing_not_configured") return { status: "pending_mover", reason: "Grille tarifaire non enregistrée." };
  if (outcome.status === "blocked") return { status: "pending_mover", reason: outcome.blockers.join(" ") };
  return { status: "pending_mover", reason: outcome.status === "error" ? outcome.message : "Devis non établi." };
}
