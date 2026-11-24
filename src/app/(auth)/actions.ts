"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { authErrorMessage, failure, success, validationFailure, type ActionState } from "@/lib/errors";
import { formToObject, safeInternalPath } from "@/lib/form-data";
import { forgotPasswordSchema, newPasswordSchema, signInSchema, signUpSchema } from "@/lib/validation/auth";
import { siteUrl } from "@/lib/site-url";

export async function signUp(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const raw = formToObject(formData);
  const parsed = signUpSchema.safeParse(raw);
  if (!parsed.success) return validationFailure(parsed.error, raw);

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { full_name: parsed.data.fullName },
      emailRedirectTo: `${await siteUrl()}/auth/confirm?suivant=/espace/bienvenue`,
    },
  });
  if (error) return failure(authErrorMessage(error, "signUp"), undefined, raw);

  // Si la confirmation par e-mail est désactivée, la session est ouverte immédiatement.
  if (data.session) redirect("/espace/bienvenue");
  return success(
    `Compte créé. Nous avons envoyé un e-mail à ${parsed.data.email} : cliquez sur le lien qu'il contient pour activer votre compte.`,
  );
}

export async function signIn(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const raw = formToObject(formData);
  const parsed = signInSchema.safeParse(raw);
  if (!parsed.success) return validationFailure(parsed.error, raw);

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return failure(authErrorMessage(error, "signIn"), undefined, raw);
  redirect(safeInternalPath(raw.suivant));
}

export async function requestPasswordReset(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const raw = formToObject(formData);
  const parsed = forgotPasswordSchema.safeParse(raw);
  if (!parsed.success) return validationFailure(parsed.error, raw);

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${await siteUrl()}/auth/confirm?suivant=/nouveau-mot-de-passe`,
  });
  // Message identique que le compte existe ou non (on ne révèle pas les adresses inscrites).
  if (error && error.code !== "user_not_found") return failure(authErrorMessage(error, "resetPasswordForEmail"));
  return success(
    "Si un compte existe avec cette adresse, vous allez recevoir un e-mail contenant un lien pour choisir un nouveau mot de passe.",
  );
}

export async function updatePassword(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = newPasswordSchema.safeParse(formToObject(formData));
  if (!parsed.success) return validationFailure(parsed.error);

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) return failure("Votre lien a expiré. Demandez un nouvel e-mail de réinitialisation.");

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return failure(authErrorMessage(error, "updateUser(password)"));
  redirect("/espace?message=mot-de-passe-modifie");
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/connexion?message=deconnecte");
}
