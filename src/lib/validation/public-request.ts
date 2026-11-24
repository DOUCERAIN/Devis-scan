import { z } from "zod";
import { checkbox, emailField, optionalInteger, optionalText, phoneField, postalCodeField, requiredText } from "./common.ts";
import { ELEVATOR_TYPES, HOUSING_TYPES } from "./request.ts";

/** Validation des formulaires du parcours particulier (côté serveur). */

const coordinate = (min: number, max: number) =>
  z.string().trim().transform((v) => (v === "" ? Number.NaN : Number(v))).pipe(z.number().min(min).max(max)).optional().catch(undefined);

const addressSchema = (label: string) =>
  z.object({
    address_line: requiredText(3, 200, `L'adresse ${label}`),
    postal_code: postalCodeField.pipe(z.string({ error: "Indiquez le code postal." })),
    city: requiredText(1, 120, `La ville ${label}`),
    latitude: coordinate(-90, 90),
    longitude: coordinate(-180, 180),
  });

const futureDate = (label: string) =>
  z.iso
    .date({ error: `Indiquez une date valide pour ${label}.` })
    .refine((v) => v >= new Date().toISOString().slice(0, 10), { error: `La ${label} doit être dans le futur.` });

export const tripSchema = z
  .object({
    customer: z.object({
      full_name: requiredText(2, 120, "Votre nom"),
      email: emailField,
      phone: phoneField,
    }),
    origin: addressSchema("de départ"),
    destination: addressSchema("d'arrivée"),
    moving_date: futureDate("date souhaitée"),
    alternative_moving_date: futureDate("date alternative").optional(),
    moving_date_flexible: checkbox,
    consent: z.literal("on", { error: "Votre accord est nécessaire pour transmettre votre demande." }),
  })
  .refine((v) => !v.alternative_moving_date || v.alternative_moving_date !== v.moving_date, {
    error: "La date alternative doit être différente de la date souhaitée.",
    path: ["alternative_moving_date"],
    when: (p) => typeof p.value === "object" && p.value !== null,
  });

export type TripInput = z.infer<typeof tripSchema>;

export function tripPayload(v: TripInput) {
  return {
    customer: { full_name: v.customer.full_name, email: v.customer.email, phone: v.customer.phone ?? "" },
    moving_date: v.moving_date,
    alternative_moving_date: v.alternative_moving_date ?? "",
    moving_date_flexible: v.moving_date_flexible,
    origin: { ...v.origin, latitude: v.origin.latitude ?? "", longitude: v.origin.longitude ?? "" },
    destination: { ...v.destination, latitude: v.destination.latitude ?? "", longitude: v.destination.longitude ?? "" },
  };
}

const dwellingDetails = z.object({
  housing_type: z.enum(HOUSING_TYPES, { error: "Choisissez le type de logement." }),
  surface_m2: optionalInteger("La surface", 1, 10000),
  room_count: optionalInteger("Le nombre de pièces", 0, 100),
  floor: optionalInteger("L'étage", -5, 100),
  elevator: z.enum(ELEVATOR_TYPES, { error: "Indiquez s'il y a un ascenseur." }),
  carrying_distance_m: optionalInteger("La distance de portage", 0, 1000),
  access_notes: optionalText(2000, "Les difficultés d'accès"),
  parking_notes: optionalText(1000, "Les contraintes"),
});

export const dwellingsSchema = z.object({ origin: dwellingDetails, destination: dwellingDetails });
export type DwellingsInput = z.infer<typeof dwellingsSchema>;

export function dwellingsPayload(v: DwellingsInput) {
  const d = (x: z.infer<typeof dwellingDetails>) => ({
    housing_type: x.housing_type,
    surface_m2: x.surface_m2 ?? "",
    room_count: x.room_count ?? "",
    floor: x.floor ?? "",
    elevator: x.elevator,
    carrying_distance_m: x.carrying_distance_m ?? "",
    access_notes: x.access_notes ?? "",
    parking_notes: x.parking_notes ?? "",
  });
  return { origin: d(v.origin), destination: d(v.destination) };
}

export const ROOM_PRESETS = [
  { kind: "living", name: "Salon" },
  { kind: "kitchen", name: "Cuisine" },
  { kind: "bedroom", name: "Chambre principale" },
  { kind: "bedroom", name: "Chambre secondaire" },
  { kind: "bathroom", name: "Salle de bain" },
  { kind: "office", name: "Bureau" },
  { kind: "garage", name: "Garage" },
  { kind: "cellar", name: "Cave" },
  { kind: "other", name: "Autre" },
] as const;

export const roomSchema = z.object({
  name: requiredText(1, 80, "Le nom de la pièce"),
  kind: z.enum(["living", "kitchen", "bedroom", "bathroom", "office", "garage", "cellar", "other"]).optional(),
  description: optionalText(1000, "La description"),
});

export const finalNotesSchema = z.object({ customer_notes: optionalText(4000, "Votre message") });
