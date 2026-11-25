"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireMembership } from "@/lib/auth/dal";
import { failure, success, validationFailure, type ActionState } from "@/lib/errors";
import { formToObject } from "@/lib/form-data";
import { verificationSchema } from "@/lib/validation/inventory";
import { finishVerification } from "@/lib/quotes/verification";

/** Fin de la vérification du dossier : confirmation des décisions du client, ou corrections (voir finishVerification). */
export async function completeVerification(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const membership = await requireMembership();
  const raw = formToObject(formData);
  const parsed = verificationSchema.safeParse(raw);
  if (!parsed.success) return validationFailure(parsed.error, raw);
  const v = parsed.data;
  const supabase = await createClient();
  const outcome = await finishVerification(supabase, { requestId: v.request_id, companyId: membership.company.id, userId: membership.id, intent: v.intent, reason: v.reason ?? null });
  revalidatePath(`/espace/demandes/${v.request_id}`);
  revalidatePath("/espace", "layout");
  if (outcome.status === "refused") return failure(outcome.message, undefined, raw);
  if (outcome.status === "confirmed") return success("Dossier vérifié : décisions du client confirmées. Aucun changement pour le client.");
  const email = outcome.email === "no_recipient" ? "aucune adresse e-mail client" : "e-mail préparé, NON envoyé (aucun service d'e-mail configuré)";
  if (outcome.status === "corrected_same_terms") return success(`Corrections enregistrées : montant et conditions du devis inchangés, aucune nouvelle version. Information du client : ${email}.`);
  if (outcome.status === "corrected_amendment") return success(`Avenant V${outcome.version} transmis au client pour accord ; son devis accepté reste en vigueur. Information du client : ${email}.`);
  return success(`Nouvelle version V${outcome.version} transmise au client. Information du client : ${email}.`);
}
