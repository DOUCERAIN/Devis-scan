import { z } from "zod";

/** Briques de validation partagées (messages en français). */

export const optionalText = (max: number, label = "Ce champ") =>
  z.string().trim().max(max, { error: `${label} ne doit pas dépasser ${max} caractères.` }).optional();

export const requiredText = (min: number, max: number, label: string) =>
  z
    .string({ error: `${label} est obligatoire.` })
    .trim()
    .min(min, { error: min <= 1 ? `${label} est obligatoire.` : `${label} doit contenir au moins ${min} caractères.` })
    .max(max, { error: `${label} ne doit pas dépasser ${max} caractères.` });

export const emailField = z
  .string({ error: "L'adresse e-mail est obligatoire." })
  .trim()
  .toLowerCase()
  .pipe(z.email({ error: "Cette adresse e-mail n'est pas valide." }));

export const optionalEmail = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email({ error: "Cette adresse e-mail n'est pas valide." }))
  .optional();

export const phoneField = z
  .string()
  .trim()
  .regex(/^\+?[0-9 .()-]{6,25}$/, { error: "Ce numéro de téléphone n'est pas valide." })
  .optional();

export const postalCodeField = z
  .string()
  .trim()
  .regex(/^[0-9A-Za-z -]{3,12}$/, { error: "Ce code postal n'est pas valide." })
  .optional();

/** Montant en euros : accepte « 85 », « 85,50 » ou « 85.5 ». */
export const euroAmount = (label: string) =>
  z
    .string({ error: `${label} est obligatoire.` })
    .trim()
    .transform((v) => v.replace(/\s/g, "").replace(",", "."))
    .transform((v) => (v === "" ? Number.NaN : Number(v)))
    .pipe(
      z
        .number({ error: `${label} doit être un nombre.` })
        .min(0, { error: `${label} ne peut pas être négatif.` })
        .max(1_000_000, { error: `${label} est trop élevé.` }),
    )
    .transform((n) => Math.round(n * 100) / 100);

export const integerField = (label: string, min: number, max: number) =>
  z
    .string({ error: `${label} est obligatoire.` })
    .trim()
    .transform((v) => (v === "" ? Number.NaN : Number(v)))
    .pipe(
      z
        .number({ error: `${label} doit être un nombre entier.` })
        .int({ error: `${label} doit être un nombre entier.` })
        .min(min, { error: `${label} doit être au moins ${min}.` })
        .max(max, { error: `${label} ne doit pas dépasser ${max}.` }),
    );

export const optionalInteger = (label: string, min: number, max: number) => integerField(label, min, max).optional();

export const checkbox = z
  .string()
  .optional()
  .transform((v) => v === "on" || v === "true");
