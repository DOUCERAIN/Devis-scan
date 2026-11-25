import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/supabase/database.types";
import { generateQuote } from "@/lib/quotes/generate";
import { compareQuoteTerms, type QuoteTerms } from "@/lib/quotes/compare";
import { customerQuoteState } from "@/lib/quotes/customer-state";
import { describeChanges, type DescribedChange } from "@/lib/inventory/changes";
import { buildCorrectionEmail, type CorrectionOutcome } from "@/lib/notifications/inventory-email";
import { queueCustomerEmail } from "@/lib/notifications/send";
import { requestReference } from "@/lib/requests/status";

type Client = SupabaseClient<Database>;

export type VerificationOutcome =
  | { status: "confirmed" }
  | { status: CorrectionOutcome; version: number | null; differences: string[]; email: "not_configured" | "no_recipient" }
  | { status: "refused"; message: string };

/** Lignes du devis telles qu'enregistrées (snapshot figé) → conditions comparables. */
function termsOf(q: { total_ttc_cents: number | null; total_ht_cents: number | null; volume_snapshot: Json | null; lines: Json }): QuoteTerms {
  const volume = (q.volume_snapshot ?? {}) as { billable_m3?: number };
  return {
    totalTtcCents: q.total_ttc_cents ?? 0,
    totalHtCents: q.total_ht_cents ?? 0,
    billableM3: volume.billable_m3 ?? null,
    lines: (Array.isArray(q.lines) ? q.lines : []) as QuoteTerms["lines"],
  };
}

/**
 * Fin de la vérification du dossier par le déménageur (session de l'utilisateur : RLS appliquée).
 *
 * - « confirm » : les décisions du client sont confirmées, l'inventaire n'a pas été modifié depuis sa
 *   validation (ou depuis la dernière vérification). Aucun changement de volume ni de prix, aucune
 *   nouvelle version, aucune notification : le dossier passe « Vérifié par le déménageur ».
 * - « correct » : l'inventaire a été corrigé (chaque correction est déjà journalisée avec son auteur).
 *   Le devis est recalculé et comparé à la version transmise au client :
 *     · conditions identiques → aucune nouvelle version, trace de la correction (cas C) ;
 *     · devis non accepté → nouvelle version transmise, qui remplace la précédente (cas A) ;
 *     · devis déjà accepté → AVENANT soumis à l'accord explicite du client ; le devis accepté reste
 *       inchangé et en vigueur (cas B).
 *   Un e-mail explicatif est préparé pour le client (envoyé dès qu'un service d'e-mail sera configuré).
 */
export async function finishVerification(
  supabase: Client,
  input: { requestId: string; companyId: string; userId: string; intent: "confirm" | "correct"; reason: string | null },
): Promise<VerificationOutcome> {
  const { data: request } = await supabase
    .from("quote_requests")
    .select("id, request_number, customer_validated_at, verification_status, customers(full_name, email), companies(name, request_reference_prefix)")
    .eq("id", input.requestId)
    .eq("company_id", input.companyId)
    .maybeSingle();
  if (!request) return { status: "refused", message: "Demande introuvable." };

  const [{ data: quotes }, { data: lastVerification }] = await Promise.all([
    supabase.from("quotes").select("id, version, status, amends_quote_id, total_ttc_cents, total_ht_cents, volume_snapshot, lines").eq("request_id", request.id).order("version", { ascending: false }),
    supabase.from("inventory_verifications").select("created_at").eq("request_id", request.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  const state = customerQuoteState(quotes ?? []);
  // Devis que le client a en main : version en attente de réponse, sinon devis accepté, sinon dernière version transmise.
  const reference = state.pending ?? state.inForce ?? (quotes ?? []).find((q) => ["refused", "expired"].includes(q.status)) ?? null;
  if (!reference) return { status: "refused", message: "Aucun devis n'a encore été transmis au client : calculez puis envoyez d'abord un devis." };

  // Corrections du déménageur depuis la validation du client (ou depuis la dernière vérification).
  const baseline = lastVerification?.created_at ?? request.customer_validated_at ?? "1970-01-01T00:00:00Z";
  const { data: rows } = await supabase
    .from("inventory_item_changes")
    .select("item_id, action, actor, changes, volume_before_m3, volume_after_m3, changed_at")
    .eq("request_id", request.id)
    .eq("actor", "mover")
    .gt("changed_at", baseline)
    .order("changed_at");
  const itemIds = [...new Set((rows ?? []).map((r) => r.item_id).filter((id): id is string => id !== null))];
  const { data: names } = itemIds.length ? await supabase.from("inventory_items").select("id, name").in("id", itemIds) : { data: [] };
  const nameOf = new Map((names ?? []).map((n) => [n.id, n.name]));
  const changes: DescribedChange[] = describeChanges((rows ?? []).map((r) => ({ ...r, item_name: r.item_id ? (nameOf.get(r.item_id) ?? null) : null })));

  const refTerms = termsOf(reference);
  const refVolume = Number(((reference.volume_snapshot ?? {}) as { estimatedM3?: number }).estimatedM3 ?? 0);
  const markVerified = (status: "verified" | "corrected") =>
    supabase.from("quote_requests").update({ verification_status: status, verified_at: new Date().toISOString(), verified_by: input.userId }).eq("id", request.id);

  if (input.intent === "confirm") {
    if (changes.length > 0) {
      return { status: "refused", message: `Vous avez modifié l'inventaire (${changes.length} correction${changes.length > 1 ? "s" : ""}) : enregistrez vos corrections et leur raison pour que le client en soit informé.` };
    }
    const { error } = await supabase.from("inventory_verifications").insert({
      request_id: request.id, company_id: input.companyId, outcome: "confirmed", changes: [],
      volume_before_m3: refVolume, volume_after_m3: refVolume, total_before_cents: refTerms.totalTtcCents, total_after_cents: refTerms.totalTtcCents,
      quote_before_id: reference.id, quote_after_id: null, verified_by: input.userId,
    });
    if (error) return { status: "refused", message: "La vérification n'a pas pu être enregistrée." };
    await markVerified("verified");
    return { status: "confirmed" };
  }

  if (changes.length === 0) return { status: "refused", message: "Aucune correction depuis la validation du client : utilisez « Confirmer l'inventaire »." };
  const reason = (input.reason ?? "").trim();
  if (reason.length < 5) return { status: "refused", message: "Expliquez la raison de la modification : elle sera communiquée au client." };

  const draft = await generateQuote(supabase, request.id, { origin: "verification", dryRun: true });
  if (draft.status === "pricing_not_configured") return { status: "refused", message: "Enregistrez d'abord votre grille tarifaire (page Tarifs)." };
  if (draft.status === "blocked") return { status: "refused", message: draft.blockers.join(" ") };
  if (draft.status !== "draft") return { status: "refused", message: "Le devis n'a pas pu être recalculé." };
  const comparison = compareQuoteTerms(refTerms, draft.terms);

  let outcome: CorrectionOutcome;
  let quoteAfterId: string | null = null;
  let version: number | null = null;
  if (comparison.identical) {
    outcome = "corrected_same_terms";
  } else {
    outcome = state.inForce ? "corrected_amendment" : "corrected_new_version";
    const created = await generateQuote(supabase, request.id, {
      origin: "verification",
      send: true,
      userId: input.userId,
      amendsQuoteId: state.inForce?.id ?? null,
      changesSummary: {
        verification: true,
        amendment: Boolean(state.inForce),
        reason,
        differences: comparison.differences,
        changes,
        previous_quote_id: reference.id,
        previous_version: reference.version,
        previous_total_ttc_cents: refTerms.totalTtcCents,
        volume_before_m3: refVolume,
        volume_after_m3: draft.estimatedM3,
      } as unknown as Json,
    });
    if (created.status !== "created") return { status: "refused", message: created.status === "blocked" ? created.blockers.join(" ") : "La nouvelle version n'a pas pu être créée." };
    quoteAfterId = created.quoteId;
    version = created.version;
  }

  const { data: verification, error } = await supabase
    .from("inventory_verifications")
    .insert({
      request_id: request.id, company_id: input.companyId, outcome, reason, changes: changes as unknown as Json[],
      volume_before_m3: refVolume, volume_after_m3: draft.estimatedM3,
      total_before_cents: refTerms.totalTtcCents, total_after_cents: draft.terms.totalTtcCents,
      quote_before_id: reference.id, quote_after_id: quoteAfterId, verified_by: input.userId,
    })
    .select("id")
    .single();
  if (error || !verification) return { status: "refused", message: "La vérification n'a pas pu être enregistrée." };
  await markVerified("corrected");

  const companyName = request.companies?.name ?? "Votre déménageur";
  const email = buildCorrectionEmail({
    companyName,
    customerName: request.customers?.full_name ?? null,
    reference: requestReference(request.companies?.request_reference_prefix ?? "DS", request.request_number),
    outcome,
    changes,
    volumeBeforeM3: refVolume,
    volumeAfterM3: draft.estimatedM3,
    totalBeforeCents: refTerms.totalTtcCents,
    totalAfterCents: draft.terms.totalTtcCents,
    reason,
    newVersion: version,
  });
  const delivery = await queueCustomerEmail(supabase, {
    requestId: request.id, companyId: input.companyId, verificationId: verification.id, kind: "inventory_corrected",
    to: request.customers?.email ?? null, subject: email.subject, text: email.text,
  });
  return { status: outcome, version, differences: comparison.differences, email: delivery };
}
