"use server";

import { revalidatePath } from "next/cache";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { publicEnv } from "@/lib/env";
import { failure, success, type ActionState } from "@/lib/errors";
import type { Database } from "@/lib/supabase/database.types";
import { requestIdForViewToken, resumeManually, validateInventory } from "@/lib/public-request/service";
import { CUSTOMER_INVENTORY_WARNING } from "@/lib/inventory/duplicates";
import { createAdminClient } from "@/lib/supabase/admin";
import { issueFinalQuote } from "@/lib/quotes/customer-validation";

/** Acceptation ou refus d'un devis ENVOYÉ par le déménageur (vérifié en base par le jeton). */
export async function respondToQuote(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const token = String(formData.get("token") ?? "");
  const slug = String(formData.get("slug") ?? "");
  const quoteId = String(formData.get("quote_id") ?? "");
  const decision = String(formData.get("decision") ?? "");
  if (!/^[0-9a-f]{64}$/.test(token) || !/^[0-9a-f-]{36}$/.test(quoteId) || !["accepted", "refused"].includes(decision)) {
    return failure("Demande invalide.");
  }
  const env = publicEnv();
  const client = createSupabaseClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
  const { data, error } = await client.rpc("respond_public_quote", { token, quote_id: quoteId, decision });
  if (error) {
    console.error("[devis] réponse", error);
    return failure("Ce devis ne peut plus recevoir de réponse. Contactez votre déménageur.");
  }
  revalidatePath(`/d/${slug}/devis/${token}`);
  if (data === "expired") return failure("Ce devis a expiré. Contactez votre déménageur pour en obtenir un nouveau.");
  return success(data === "accepted" ? "Merci, votre acceptation a été transmise." : "Votre refus a été transmis.");
}

/**
 * Validation de l'inventaire par le client : une réponse pour CHAQUE élément à vérifier et l'avertissement
 * accepté (contrôlés ici puis en base). Le devis final est ensuite calculé et transmis immédiatement.
 */
export async function validateCustomerInventory(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const token = String(formData.get("token") ?? "");
  const slug = String(formData.get("slug") ?? "");
  if (!/^[0-9a-f]{64}$/.test(token)) return failure("Demande invalide.");
  const expected = formData.getAll("item").map(String).filter((id) => /^[0-9a-f-]{36}$/.test(id));
  const decisions: Record<string, "distinct" | "same"> = {};
  const fieldErrors: Record<string, string> = {};
  for (const id of expected) {
    const value = String(formData.get(`decision_${id}`) ?? "");
    if (value === "distinct" || value === "same") decisions[id] = value;
    else fieldErrors[`decision_${id}`] = "Choisissez une réponse pour cet élément.";
  }
  if (Object.keys(fieldErrors).length > 0) {
    return failure(`Répondez à chaque élément à vérifier (${Object.keys(fieldErrors).length} sans réponse).`, fieldErrors);
  }
  if (formData.get("acknowledged") !== "on") {
    return failure("Confirmez avoir pris connaissance de l'avertissement avant de valider.", { acknowledged: "Confirmation obligatoire." });
  }
  try {
    await validateInventory(token, decisions, CUSTOMER_INVENTORY_WARNING);
  } catch (error) {
    console.error("[inventaire] validation", error);
    return failure("Votre inventaire n'a pas pu être validé : il a peut-être déjà été validé, ou des éléments restent sans réponse. Rechargez la page.");
  }
  const requestId = await requestIdForViewToken(token);
  const admin = createAdminClient();
  const outcome = requestId && admin ? await issueFinalQuote(admin, requestId) : { status: "pending_mover" as const, reason: "configuration serveur incomplète" };
  if (outcome.status === "pending_mover") console.warn("[inventaire] devis final en attente du déménageur :", outcome.reason);
  revalidatePath(`/d/${slug}/devis/${token}`);
  return success(outcome.status === "sent" ? "Inventaire validé : votre devis est prêt ci-dessous." : "Inventaire validé. Votre déménageur finalise votre devis : vous le retrouverez sur cette page.");
}

/** Analyse impossible : le client passe à la saisie de son inventaire (vérifié en base : analyse échouée, aucun devis). */
export async function startManualInventory(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const token = String(formData.get("token") ?? "");
  const slug = String(formData.get("slug") ?? "");
  if (!/^[0-9a-f]{64}$/.test(token)) return failure("Demande invalide.");
  try {
    await resumeManually(token);
  } catch (error) {
    console.error("[inventaire] reprise manuelle", error);
    return failure("Votre inventaire ne peut pas être complété ici. Rechargez la page.");
  }
  revalidatePath(`/d/${slug}/devis/${token}`);
  return success("Vous pouvez compléter votre inventaire.");
}
