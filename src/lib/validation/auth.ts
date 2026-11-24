import { z } from "zod";
import { emailField, requiredText } from "./common.ts";

export const passwordField = z
  .string({ error: "Le mot de passe est obligatoire." })
  .min(8, { error: "Le mot de passe doit contenir au moins 8 caractères." })
  .max(72, { error: "Le mot de passe ne doit pas dépasser 72 caractères." })
  .refine((v) => /[A-Za-z]/.test(v) && /[0-9]/.test(v), {
    error: "Le mot de passe doit contenir au moins une lettre et un chiffre.",
  });

export const signUpSchema = z.object({
  fullName: requiredText(2, 120, "Votre nom"),
  email: emailField,
  password: passwordField,
  acceptTerms: z.literal("on", { error: "Vous devez accepter les conditions pour créer un compte." }),
});

export const signInSchema = z.object({
  email: emailField,
  password: z.string({ error: "Le mot de passe est obligatoire." }).min(1, { error: "Le mot de passe est obligatoire." }),
});

export const forgotPasswordSchema = z.object({ email: emailField });

export const newPasswordSchema = z
  .object({ password: passwordField, confirmPassword: z.string({ error: "Confirmez le mot de passe." }) })
  .refine((v) => v.password === v.confirmPassword, {
    error: "Les deux mots de passe ne sont pas identiques.",
    path: ["confirmPassword"],
  });
