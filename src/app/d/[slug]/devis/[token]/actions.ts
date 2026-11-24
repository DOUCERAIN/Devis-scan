"use server";

import { revalidatePath } from "next/cache";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { publicEnv } from "@/lib/env";
import { failure, success, type ActionState } from "@/lib/errors";
import type { Database } from "@/lib/supabase/database.types";

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
