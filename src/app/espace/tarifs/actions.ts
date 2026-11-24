"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { canManageSettings, requireMembership } from "@/lib/auth/dal";
import { dbErrorMessage, failure, success, validationFailure, type ActionState } from "@/lib/errors";
import { formToObject } from "@/lib/form-data";
import { idSchema, itemSurchargeSchema, pricingOptionSchema, pricingSettingsSchema } from "@/lib/validation/pricing";

const FORBIDDEN = "Seuls le propriétaire et les administrateurs peuvent modifier les tarifs.";

async function context() {
  const { company, role } = await requireMembership();
  return { companyId: company.id, allowed: canManageSettings(role) };
}

function done(message: string): ActionState {
  revalidatePath("/espace/tarifs");
  return success(message);
}

export async function updatePricingSettings(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { companyId, allowed } = await context();
  if (!allowed) return failure(FORBIDDEN);
  const raw = formToObject(formData);
  const parsed = pricingSettingsSchema.safeParse(raw);
  if (!parsed.success) return validationFailure(parsed.error, raw);

  const supabase = await createClient();
  const { data, error } = await supabase.from("pricing_settings").update(parsed.data).eq("company_id", companyId).select("company_id").maybeSingle();
  if (error) return failure(dbErrorMessage(error, "updatePricingSettings"), undefined, raw);
  if (!data) return failure(FORBIDDEN);
  return done("Grille tarifaire enregistrée.");
}

export async function saveOption(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { companyId, allowed } = await context();
  if (!allowed) return failure(FORBIDDEN);
  const raw = formToObject(formData);
  const parsed = pricingOptionSchema.safeParse(raw);
  if (!parsed.success) return validationFailure(parsed.error, raw);
  const values = { ...parsed.data, description: parsed.data.description ?? null, is_active: raw.is_active === "on" || !raw.id };

  const supabase = await createClient();
  if (raw.id) {
    const id = idSchema.safeParse({ id: raw.id });
    if (!id.success) return failure("Option introuvable.");
    const { data, error } = await supabase.from("pricing_options").update(values).eq("id", id.data.id).eq("company_id", companyId).select("id").maybeSingle();
    if (error) return failure(dbErrorMessage(error, "updateOption"), undefined, raw);
    if (!data) return failure("Option introuvable.");
    return done("Option enregistrée.");
  }
  const { count } = await supabase.from("pricing_options").select("id", { count: "exact", head: true }).eq("company_id", companyId);
  const { error } = await supabase.from("pricing_options").insert({ ...values, company_id: companyId, position: (count ?? 0) + 1 });
  if (error) return failure(dbErrorMessage(error, "insertOption"), undefined, raw);
  return done("Option ajoutée.");
}

export async function deleteOption(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { companyId, allowed } = await context();
  if (!allowed) return failure(FORBIDDEN);
  const parsed = idSchema.safeParse(formToObject(formData));
  if (!parsed.success) return failure("Option introuvable.");
  const supabase = await createClient();
  const { data, error } = await supabase.from("pricing_options").delete().eq("id", parsed.data.id).eq("company_id", companyId).select("id");
  if (error) return failure(dbErrorMessage(error, "deleteOption"));
  if (!data?.length) return failure("Option introuvable.");
  return done("Option supprimée.");
}

export async function addSurcharge(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { companyId, allowed } = await context();
  if (!allowed) return failure(FORBIDDEN);
  const raw = formToObject(formData);
  const parsed = itemSurchargeSchema.safeParse(raw);
  if (!parsed.success) return validationFailure(parsed.error, raw);
  const supabase = await createClient();
  const { error } = await supabase.from("pricing_item_surcharges").insert({ ...parsed.data, company_id: companyId });
  if (error) {
    if (error.code === "23505") return failure("Cet objet a déjà un supplément.", { name: "Déjà présent dans la liste." }, raw);
    return failure(dbErrorMessage(error, "addSurcharge"), undefined, raw);
  }
  return done("Supplément ajouté.");
}

export async function deleteSurcharge(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { companyId, allowed } = await context();
  if (!allowed) return failure(FORBIDDEN);
  const parsed = idSchema.safeParse(formToObject(formData));
  if (!parsed.success) return failure("Élément introuvable.");
  const supabase = await createClient();
  const { data, error } = await supabase.from("pricing_item_surcharges").delete().eq("id", parsed.data.id).eq("company_id", companyId).select("id");
  if (error) return failure(dbErrorMessage(error, "deleteSurcharge"));
  if (!data?.length) return failure("Élément introuvable.");
  return done("Supplément supprimé.");
}
