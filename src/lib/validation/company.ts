import { z } from "zod";
import { emailField, integerField, optionalText, phoneField, postalCodeField, requiredText } from "./common.ts";

export const createCompanySchema = z.object({
  name: requiredText(2, 120, "Le nom de l'entreprise"),
});

export const companyProfileSchema = z.object({
  name: requiredText(2, 120, "Le nom commercial"),
  legal_name: optionalText(160, "La raison sociale"),
  siret: z
    .string()
    .trim()
    .transform((v) => v.replace(/\s/g, ""))
    .pipe(z.string().regex(/^[0-9]{14}$/, { error: "Le SIRET doit contenir 14 chiffres." }))
    .optional(),
  vat_number: z
    .string()
    .trim()
    .transform((v) => v.replace(/\s/g, "").toUpperCase())
    .pipe(z.string().regex(/^[A-Z]{2}[0-9A-Z]{2,13}$/, { error: "Ce numéro de TVA n'est pas valide." }))
    .optional(),
  email: emailField.optional(),
  phone: phoneField,
  website: z
    .string()
    .trim()
    .transform((v) => (/^https?:\/\//i.test(v) ? v : `https://${v}`))
    .pipe(z.url({ error: "Cette adresse de site n'est pas valide." }).max(200))
    .optional(),
  address_line1: optionalText(200, "L'adresse"),
  address_line2: optionalText(200, "Le complément d'adresse"),
  postal_code: postalCodeField,
  city: optionalText(120, "La ville"),
});

export const companyQuoteSettingsSchema = z.object({
  quote_validity_days: integerField("La durée de validité", 1, 365),
  payment_terms: optionalText(2000, "Les conditions de paiement"),
  quote_terms: optionalText(10000, "Les conditions commerciales"),
  insurance_info: optionalText(2000, "Les informations d'assurance"),
  video_retention_days: integerField("La durée de conservation", 7, 365),
});

export const brandColorSchema = z.object({
  use_default_color: z.string().optional(),
  brand_color: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^#[0-9a-f]{6}$/, { error: "Choisissez une couleur au format #RRGGBB." })
    .optional(),
});

export const LOGO_MAX_BYTES = 2 * 1024 * 1024;
export const LOGO_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};
