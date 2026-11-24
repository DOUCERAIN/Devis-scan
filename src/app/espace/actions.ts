"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getMembership, requireUser } from "@/lib/auth/dal";
import { dbErrorMessage, failure, validationFailure, type ActionState } from "@/lib/errors";
import { formToObject } from "@/lib/form-data";
import { createCompanySchema } from "@/lib/validation/company";

/** Création de l'entreprise lors de la première connexion. */
export async function createCompany(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireUser();
  if (await getMembership()) redirect("/espace");

  const raw = formToObject(formData);
  const parsed = createCompanySchema.safeParse(raw);
  if (!parsed.success) return validationFailure(parsed.error, raw);

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_company", { company_name: parsed.data.name });
  if (error) {
    if (error.code === "23505") redirect("/espace");
    return failure(dbErrorMessage(error, "create_company"), undefined, raw);
  }
  revalidatePath("/espace", "layout");
  redirect("/espace?message=bienvenue");
}
