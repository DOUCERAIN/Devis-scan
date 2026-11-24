"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireMembership } from "@/lib/auth/dal";
import { dbErrorMessage, failure, success, validationFailure, type ActionState } from "@/lib/errors";
import { formToObject, nestDotted } from "@/lib/form-data";
import { internalNotesSchema, manualRequestSchema, statusChangeSchema, toManualRequestPayload } from "@/lib/validation/request";

export async function createManualRequest(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireMembership();
  const raw = formToObject(formData);
  const parsed = manualRequestSchema.safeParse(nestDotted(raw));
  if (!parsed.success) return validationFailure(parsed.error, raw);

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_manual_request", { payload: toManualRequestPayload(parsed.data) });
  if (error || !data) return failure(dbErrorMessage(error, "create_manual_request"), undefined, raw);

  revalidatePath("/espace", "layout");
  redirect(`/espace/demandes/${data}?message=creee`);
}

export async function changeRequestStatus(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { company } = await requireMembership();
  const parsed = statusChangeSchema.safeParse(formToObject(formData));
  if (!parsed.success) return validationFailure(parsed.error);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("quote_requests")
    .update({ status: parsed.data.status as never })
    .eq("id", parsed.data.id)
    .eq("company_id", company.id)
    .select("id")
    .maybeSingle();
  if (error) return failure(dbErrorMessage(error, "changeRequestStatus"));
  if (!data) return failure("Demande introuvable.");

  revalidatePath("/espace", "layout");
  return success("Statut mis à jour.");
}

export async function updateInternalNotes(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { company } = await requireMembership();
  const raw = formToObject(formData);
  const parsed = internalNotesSchema.safeParse(raw);
  if (!parsed.success) return validationFailure(parsed.error, raw);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("quote_requests")
    .update({ internal_notes: parsed.data.internal_notes ?? null })
    .eq("id", parsed.data.id)
    .eq("company_id", company.id)
    .select("id")
    .maybeSingle();
  if (error) return failure(dbErrorMessage(error, "updateInternalNotes"), undefined, raw);
  if (!data) return failure("Demande introuvable.");

  revalidatePath(`/espace/demandes/${parsed.data.id}`);
  return success("Notes enregistrées.");
}
