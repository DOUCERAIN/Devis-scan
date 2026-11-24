import { z } from "zod";
import { checkbox, optionalEmail, optionalInteger, optionalText, phoneField, postalCodeField, requiredText } from "./common.ts";
import { MANUAL_STATUSES } from "../requests/status.ts";

export const HOUSING_TYPES = ["apartment", "house", "storage_unit", "office", "other"] as const;
export const ELEVATOR_TYPES = ["none", "small", "standard", "large"] as const;

export const dwellingSchema = z.object({
  address_line: optionalText(200, "L'adresse"),
  postal_code: postalCodeField,
  city: requiredText(1, 120, "La ville"),
  housing_type: z.enum(HOUSING_TYPES, { error: "Choisissez un type de logement." }).optional(),
  floor: optionalInteger("L'étage", -5, 100),
  elevator: z.enum(ELEVATOR_TYPES, { error: "Choisissez une option d'ascenseur." }).optional(),
  carrying_distance_m: optionalInteger("La distance de portage", 0, 1000),
  access_notes: optionalText(2000, "Les remarques d'accès"),
});

/** Formulaire de création manuelle (champs nommés « customer.full_name », « origin.city »…). */
export const manualRequestSchema = z
  .object({
    customer: z.object({
      full_name: requiredText(1, 120, "Le nom du client"),
      email: optionalEmail,
      phone: phoneField,
    }),
    moving_date: z.iso.date({ error: "Indiquez une date valide." }).optional(),
    moving_date_flexible: checkbox,
    customer_notes: optionalText(4000, "Les remarques"),
    origin: dwellingSchema,
    destination: dwellingSchema,
  })
  .refine((v) => Boolean(v.customer?.email || v.customer?.phone), {
    error: "Indiquez au moins un e-mail ou un téléphone pour joindre le client.",
    path: ["customer", "email"],
    // Vérifié même si d'autres champs sont en erreur, pour tout signaler en une fois.
    when: (payload) => typeof payload.value === "object" && payload.value !== null,
  });

export type ManualRequestInput = z.infer<typeof manualRequestSchema>;

/** Document JSON attendu par la fonction SQL create_manual_request (valeurs absentes = null). */
export function toManualRequestPayload(v: ManualRequestInput) {
  const dwelling = (d: z.infer<typeof dwellingSchema>) => ({
    address_line: d.address_line ?? null,
    postal_code: d.postal_code ?? null,
    city: d.city,
    housing_type: d.housing_type ?? null,
    floor: d.floor ?? null,
    elevator: d.elevator ?? null,
    carrying_distance_m: d.carrying_distance_m ?? null,
    access_notes: d.access_notes ?? null,
  });
  return {
    customer: { full_name: v.customer.full_name, email: v.customer.email ?? null, phone: v.customer.phone ?? null },
    moving_date: v.moving_date ?? null,
    moving_date_flexible: v.moving_date_flexible,
    customer_notes: v.customer_notes ?? null,
    origin: dwelling(v.origin),
    destination: dwelling(v.destination),
  };
}

export const statusChangeSchema = z.object({
  id: z.uuid({ error: "Demande introuvable." }),
  status: z.enum(MANUAL_STATUSES as unknown as [string, ...string[]], { error: "Statut invalide." }),
});

export const internalNotesSchema = z.object({
  id: z.uuid({ error: "Demande introuvable." }),
  internal_notes: optionalText(4000, "Les notes"),
});
