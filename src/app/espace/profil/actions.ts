"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/dal";
import { authErrorMessage, dbErrorMessage, failure, success, validationFailure, type ActionState } from "@/lib/errors";
import { formToObject } from "@/lib/form-data";
import { profileSchema } from "@/lib/validation/profile";
import { newPasswordSchema } from "@/lib/validation/auth";
import { z } from "zod";

export async function updateProfile(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const raw = formToObject(formData);
  const parsed = profileSchema.safeParse(raw);
  if (!parsed.success) return validationFailure(parsed.error, raw);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .update({ full_name: parsed.data.full_name, phone: parsed.data.phone ?? null })
    .eq("id", user.id)
    .select("id")
    .maybeSingle();
  if (error || !data) return failure(dbErrorMessage(error, "updateProfile"), undefined, raw);
  revalidatePath("/espace", "layout");
  return success("Profil enregistré.");
}

const changePasswordSchema = newPasswordSchema.and(z.object({ currentPassword: z.string().min(1, { error: "Indiquez votre mot de passe actuel." }) }));

export async function changePassword(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = changePasswordSchema.safeParse(formToObject(formData));
  if (!parsed.success) return validationFailure(parsed.error);
  if (!user.email) return failure("Compte sans adresse e-mail.");

  const supabase = await createClient();
  // On revérifie le mot de passe actuel avant de le changer.
  const check = await supabase.auth.signInWithPassword({ email: user.email, password: parsed.data.currentPassword });
  if (check.error) {
    return check.error.code === "invalid_credentials"
      ? failure("Le mot de passe actuel est incorrect.", { currentPassword: "Mot de passe incorrect." })
      : failure(authErrorMessage(check.error, "changePassword(check)"));
  }
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return failure(authErrorMessage(error, "changePassword"));
  return success("Mot de passe modifié.");
}
