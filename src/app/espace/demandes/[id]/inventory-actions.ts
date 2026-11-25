"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireMembership } from "@/lib/auth/dal";
import { dbErrorMessage, failure, success, validationFailure, type ActionState } from "@/lib/errors";
import { formToObject } from "@/lib/form-data";
import { itemAddSchema, itemUpdateSchema } from "@/lib/validation/inventory";
import { generateQuote, hasLegalIdentity } from "@/lib/quotes/generate";
import type { Database, Json } from "@/lib/supabase/database.types";
import { effectiveDuplicateDecision } from "@/lib/inventory/volume";

/**
 * Corrections de l'inventaire par le déménageur. Chaque modification est journalisée
 * (inventory_item_changes : avant / après, auteur, date, impact sur le volume).
 * La proposition d'origine de l'IA (ai_proposal) n'est jamais modifiée.
 * Le devis n'est jamais modifié en silence : une nouvelle version est créée à la demande.
 */

/** Volume compté d'une ligne : 0 si retirée ou déclarée « même meuble » (décision du déménageur, sinon du client). */
const lineVolume = (i: { quantity: number; unit_volume_m3: number | string; removed: boolean; customer_duplicate_decision?: string | null; mover_duplicate_decision?: string | null }) =>
  i.removed || effectiveDuplicateDecision(i.customer_duplicate_decision, i.mover_duplicate_decision) === "same" ? 0 : i.quantity * Number(i.unit_volume_m3);

export async function updateInventoryItem(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const membership = await requireMembership();
  const { company } = membership;
  const user = { id: membership.id };
  const raw = formToObject(formData);
  const parsed = itemUpdateSchema.safeParse(raw);
  if (!parsed.success) return validationFailure(parsed.error, raw);
  const v = parsed.data;

  const supabase = await createClient();
  const { data: item } = await supabase
    .from("inventory_items")
    .select("id, request_id, name, quantity, unit_volume_m3, room_id, removed, possible_duplicate, duplicate_reason, validated_by_human, customer_duplicate_decision, mover_duplicate_decision")
    .eq("id", v.id)
    .eq("request_id", v.request_id)
    .eq("company_id", company.id)
    .maybeSingle();
  if (!item) return failure("Élément introuvable.");

  const patch: Database["public"]["Tables"]["inventory_items"]["Update"] = { human_modified: true };
  let action: "update" | "remove" | "restore" | "confirm" | "duplicate_decision" = "update";
  if (v.intent === "save") {
    Object.assign(patch, { name: v.name, quantity: v.quantity, unit_volume_m3: v.unit_volume_m3, room_id: v.room_id || null, validated_by_human: true, validated_by: user.id, validated_at: new Date().toISOString(), volume_source: "human" });
  } else if (v.intent === "confirm") {
    action = "confirm";
    Object.assign(patch, { validated_by_human: true, validated_by: user.id, validated_at: new Date().toISOString() });
  } else if (v.intent === "remove") {
    action = "remove";
    patch.removed = true;
  } else if (v.intent === "restore") {
    action = "restore";
    patch.removed = false;
  } else {
    // Décision du déménageur sur un doublon possible : enregistrée à part. Le signalement d'origine et la
    // réponse du client restent intacts (inventaire initial et décisions du client préservés).
    const decision = v.intent === "same_object" ? "same" : "distinct";
    Object.assign(patch, { mover_duplicate_decision: decision, mover_decided_at: new Date().toISOString(), mover_decided_by: user.id });
    // Même avis que le client : simple confirmation, pas une modification de l'inventaire.
    action = item.customer_duplicate_decision === decision ? "confirm" : "duplicate_decision";
  }

  const before = { name: item.name, quantity: item.quantity, unit_volume_m3: Number(item.unit_volume_m3), room_id: item.room_id, removed: item.removed, possible_duplicate: item.possible_duplicate, duplicate_reason: item.duplicate_reason, validated_by_human: item.validated_by_human, mover_duplicate_decision: item.mover_duplicate_decision };
  const after = { ...before, ...Object.fromEntries(Object.entries(patch).filter(([k]) => k in before)) } as typeof before;
  const changes = Object.fromEntries(
    Object.keys(before)
      .filter((k) => JSON.stringify(before[k as keyof typeof before]) !== JSON.stringify(after[k as keyof typeof after]))
      .map((k) => [k, { avant: before[k as keyof typeof before], apres: after[k as keyof typeof after] }]),
  );
  if (Object.keys(changes).length === 0) return success("Aucune modification.");

  const { error } = await supabase.from("inventory_items").update(patch).eq("id", item.id).eq("company_id", company.id);
  if (error) return failure(dbErrorMessage(error, "updateInventoryItem"));
  await supabase.from("inventory_item_changes").insert({
    item_id: item.id,
    request_id: item.request_id,
    company_id: company.id,
    action,
    changes: (action === "duplicate_decision" || action === "confirm" ? { ...changes, name: item.name, decision: after.mover_duplicate_decision ?? undefined } : changes) as unknown as Json[],
    volume_before_m3: lineVolume(item),
    volume_after_m3: lineVolume({ quantity: after.quantity, unit_volume_m3: after.unit_volume_m3, removed: after.removed, customer_duplicate_decision: item.customer_duplicate_decision, mover_duplicate_decision: after.mover_duplicate_decision }),
    changed_by: user.id,
  });
  revalidatePath(`/espace/demandes/${item.request_id}`);
  return success("Inventaire mis à jour. Pensez à recalculer le devis.");
}

export async function addInventoryItem(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const membership = await requireMembership();
  const { company } = membership;
  const user = { id: membership.id };
  const raw = formToObject(formData);
  const parsed = itemAddSchema.safeParse(raw);
  if (!parsed.success) return validationFailure(parsed.error, raw);
  const v = parsed.data;
  const supabase = await createClient();

  const { data: request } = await supabase.from("quote_requests").select("id").eq("id", v.request_id).eq("company_id", company.id).maybeSingle();
  if (!request) return failure("Demande introuvable.");
  let name = v.name;
  let volume = v.unit_volume_m3;
  let heavy = false;
  let catalogKey: string | null = null;
  if (v.catalog_key) {
    const { data: ref } = await supabase.from("furniture_catalog").select("id, name, moving_volume_avg, heavy").eq("id", v.catalog_key).maybeSingle();
    if (!ref) return failure("Référence du catalogue inconnue.", undefined, raw);
    catalogKey = ref.id;
    name = name ?? ref.name;
    heavy = ref.heavy;
    if (volume === undefined && ref.moving_volume_avg !== null) volume = Number(ref.moving_volume_avg);
  }
  if (!name) return failure("Choisissez un objet du catalogue ou saisissez un nom.", { name: "Le nom est obligatoire." }, raw);
  if (volume === undefined) return failure("Ce meuble n'a pas de volume de référence : indiquez son volume.", { unit_volume_m3: "Le volume est obligatoire." }, raw);

  const { data: inserted, error } = await supabase
    .from("inventory_items")
    .insert({
      request_id: request.id,
      company_id: company.id,
      room_id: v.room_id || null,
      name,
      catalog_key: catalogKey,
      quantity: v.quantity,
      unit_volume_m3: volume,
      source: "mover",
      volume_source: "human",
      is_heavy: heavy,
      validated_by_human: true,
      validated_by: user.id,
      validated_at: new Date().toISOString(),
      human_modified: true,
    })
    .select("id")
    .single();
  if (error || !inserted) return failure(dbErrorMessage(error, "addInventoryItem"), undefined, raw);
  await supabase.from("inventory_item_changes").insert({
    item_id: inserted.id,
    request_id: request.id,
    company_id: company.id,
    action: "add",
    changes: { name, quantity: v.quantity, unit_volume_m3: volume } as unknown as Json[],
    volume_before_m3: 0,
    volume_after_m3: v.quantity * volume,
    changed_by: user.id,
  });
  revalidatePath(`/espace/demandes/${request.id}`);
  return success("Objet ajouté.");
}

/** Nouvelle version du devis à partir de l'inventaire et de la grille actuels. */
export async function recalculateQuote(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const membership = await requireMembership();
  const { company } = membership;
  const user = { id: membership.id };
  const requestId = String(formData.get("request_id") ?? "");
  const send = formData.get("send") === "1";
  const supabase = await createClient();
  const { data: request } = await supabase.from("quote_requests").select("id, status").eq("id", requestId).eq("company_id", company.id).maybeSingle();
  if (!request) return failure("Demande introuvable.");
  if (request.status === "accepted") return failure("Le client a accepté un devis : il ne peut plus être remplacé. Terminez la vérification avec vos corrections : un avenant lui sera proposé.");
  // Un devis a déjà été transmis au client : toute modification passe par la vérification (traçabilité, information du client).
  const { count: transmitted } = await supabase.from("quotes").select("id", { count: "exact", head: true }).eq("request_id", requestId).in("status", ["sent", "accepted", "refused", "expired"]);
  if ((transmitted ?? 0) > 0) return failure("Un devis a déjà été transmis au client : enregistrez vos corrections avec « Terminer la vérification ».");

  if (send) {
    const { data: c } = await supabase.from("companies").select("legal_name, siret, address_line1, postal_code, city").eq("id", company.id).single();
    if (!c || !hasLegalIdentity(c)) {
      return failure("Pour envoyer un devis, renseignez d'abord la raison sociale, le SIRET et l'adresse de votre entreprise (page Entreprise).");
    }
  }

  // Résumé des corrections depuis le devis précédent
  const { data: last } = await supabase.from("quotes").select("created_at, total_ttc_cents").eq("request_id", requestId).order("version", { ascending: false }).limit(1).maybeSingle();
  const { data: changes } = await supabase
    .from("inventory_item_changes")
    .select("action, changes, volume_before_m3, volume_after_m3, changed_at")
    .eq("request_id", requestId)
    .gt("changed_at", last?.created_at ?? "1970-01-01")
    .order("changed_at");
  const volumeDelta = (changes ?? []).reduce((s, c) => s + Number(c.volume_after_m3 ?? 0) - Number(c.volume_before_m3 ?? 0), 0);

  const outcome = await generateQuote(supabase, requestId, {
    origin: "correction",
    userId: user.id,
    send,
    changesSummary: { corrections: changes?.length ?? 0, volume_delta_m3: Math.round(volumeDelta * 1000) / 1000, previous_total_ttc_cents: last?.total_ttc_cents ?? null } as Json,
  });
  revalidatePath(`/espace/demandes/${requestId}`);
  if (outcome.status === "pricing_not_configured") return failure("Enregistrez d'abord votre grille tarifaire (page Tarifs).");
  if (outcome.status === "blocked") return failure(outcome.blockers.join(" "));
  if (outcome.status === "error") return failure(outcome.message);
  if (outcome.status !== "created") return failure("Le devis n'a pas pu être enregistré.");
  revalidatePath("/espace", "layout");
  return success(send ? `Devis V${outcome.version} envoyé : le client le voit sur son lien de suivi.` : `Version ${outcome.version} calculée.`);
}
