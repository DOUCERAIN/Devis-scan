import { z } from "zod";
import { checkbox, emailField, integerField, optionalInteger, optionalText, postalCodeField, requiredText } from "./common.ts";
import { MANUAL_CATEGORY_KEYS, SIZE_CLASS_VALUES } from "../inventory/manual.ts";
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

const dwellingDetails = z.object({
  housing_type: z.enum(HOUSING_TYPES, { error: "Choisissez le type de logement." }),
  surface_m2: optionalInteger("La surface", 1, 10000),
  room_count: optionalInteger("Le nombre de pièces", 0, 100),
  floor: z
    .string({ error: "Indiquez l'étage (rez-de-chaussée compris)." })
    .trim()
    .min(1, { error: "Indiquez l'étage (rez-de-chaussée compris)." })
    .pipe(integerField("L'étage", -3, 60)),
  elevator: z.enum(ELEVATOR_TYPES, { error: "Indiquez s'il y a un ascenseur." }),
  carrying_distance_m: optionalInteger("La distance de portage", 0, 1000),
  access_notes: optionalText(2000, "Les difficultés d'accès"),
  parking_notes: optionalText(1000, "Les contraintes"),
});

const place = (label: string) => addressSchema(label).extend(dwellingDetails.shape);

/** Étape 1 « Déménagement » : adresses, logements (étage obligatoire), date souhaitée. */
export const tripSchema = z.object({
  origin: place("de départ"),
  destination: place("d'arrivée"),
  moving_date: futureDate("date souhaitée"),
  moving_date_flexible: checkbox,
});

export type TripInput = z.infer<typeof tripSchema>;
export const MAX_ALTERNATIVE_DATES = 30;

/**
 * Dates alternatives (facultatives, nombre libre jusqu'à 30) : chacune valide, dans le futur, différente de
 * la date souhaitée et des autres. Les champs laissés vides sont ignorés. Erreurs indexées par position.
 */
export function checkAlternativeDates(values: readonly string[], movingDate: string | undefined, today = new Date().toISOString().slice(0, 10)) {
  const errors: Record<string, string> = {};
  const dates: string[] = [];
  const filled = values.map((v) => v.trim());
  if (filled.filter(Boolean).length > MAX_ALTERNATIVE_DATES) {
    return { dates, errors: { alternative_moving_dates: `${MAX_ALTERNATIVE_DATES} dates alternatives au maximum.` } };
  }
  filled.forEach((v, i) => {
    if (!v) return;
    const key = `alternative_moving_dates.${i}`;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v) || Number.isNaN(Date.parse(`${v}T00:00:00Z`))) errors[key] = "Date invalide.";
    else if (v < today) errors[key] = "Cette date doit être dans le futur.";
    else if (v === movingDate) errors[key] = "Cette date est déjà votre date souhaitée.";
    else if (dates.includes(v)) errors[key] = "Cette date est déjà proposée.";
    else dates.push(v);
  });
  return { dates: [...dates].sort(), errors };
}

export function tripPayload(v: TripInput, alternativeDates: string[]) {
  const d = (x: TripInput["origin"]) => ({
    address_line: x.address_line, postal_code: x.postal_code, city: x.city,
    latitude: x.latitude ?? "", longitude: x.longitude ?? "",
    housing_type: x.housing_type, surface_m2: x.surface_m2 ?? "", room_count: x.room_count ?? "", floor: x.floor,
    elevator: x.elevator, carrying_distance_m: x.carrying_distance_m ?? "", access_notes: x.access_notes ?? "", parking_notes: x.parking_notes ?? "",
  });
  return {
    moving_date: v.moving_date,
    alternative_moving_dates: alternativeDates,
    moving_date_flexible: v.moving_date_flexible,
    origin: d(v.origin),
    destination: d(v.destination),
  };
}

/** Étape 2 « Coordonnées » : particulier ou entreprise ; téléphone obligatoire ; SIRET facultatif. */
export const contactSchema = z
  .object({
    type: z.enum(["individual", "company"], { error: "Indiquez si vous êtes un particulier ou une entreprise." }),
    company_name: optionalText(160, "Le nom de l'entreprise"),
    siret: z
      .string()
      .transform((v) => v.replace(/\s/g, ""))
      .pipe(z.string().regex(/^\d{14}$/, { error: "Le SIRET comporte 14 chiffres." }))
      .optional(),
    first_name: requiredText(1, 80, "Votre prénom"),
    last_name: requiredText(1, 80, "Votre nom"),
    email: emailField,
    phone: z
      .string({ error: "Le téléphone est obligatoire." })
      .trim()
      .regex(/^\+?[0-9 .()-]{6,25}$/, { error: "Ce numéro de téléphone n'est pas valide." })
      .refine((v) => v.replace(/\D/g, "").length >= 9 && v.replace(/\D/g, "").length <= 15, { error: "Ce numéro de téléphone n'est pas valide." }),
    privacy: z.literal("on", { error: "Votre accord est nécessaire pour établir votre devis." }),
    marketing: checkbox,
  })
  // Contrôlé même si d'autres champs sont en erreur (tous les messages s'affichent d'un coup).
  .refine((v) => v.type !== "company" || Boolean(v.company_name), {
    error: "Le nom de l'entreprise est obligatoire.",
    path: ["company_name"],
    when: (p) => {
      const v = p.value as { type?: unknown; company_name?: unknown } | null;
      return typeof v === "object" && v !== null && v.type === "company";
    },
  });

export type ContactInput = z.infer<typeof contactSchema>;

export function contactPayload(v: ContactInput) {
  return {
    customer: {
      type: v.type,
      first_name: v.first_name,
      last_name: v.last_name,
      email: v.email,
      phone: v.phone,
      company_name: v.type === "company" ? (v.company_name ?? "") : "",
      siret: v.type === "company" ? (v.siret ?? "") : "",
      privacy_accepted: true,
      marketing_consent: v.marketing,
    },
  };
}

export const methodSchema = z.object({
  inventory_method: z.enum(["video", "manual"], { error: "Choisissez comment établir votre inventaire." }),
});

const dimension = (label: string) => optionalInteger(label, 1, 2000);

/** Objet ajouté par le client (catalogue ou personnalisé). Sans volume connu : dimensions ou taille exigées. */
export const customItemSchema = z
  .object({
    label: requiredText(2, 120, "La description de l'objet"),
    category: z.enum(MANUAL_CATEGORY_KEYS, { error: "Choisissez une catégorie." }),
    quantity: integerField("La quantité", 1, 999),
    width_cm: dimension("La largeur"),
    depth_cm: dimension("La profondeur"),
    height_cm: dimension("La hauteur"),
    size: z.enum(SIZE_CLASS_VALUES, { error: "Choisissez une taille." }).optional(),
    comment: optionalText(1000, "Le commentaire"),
  })
  .superRefine(
    (v, ctx) => {
      const dims = [v.width_cm, v.depth_cm, v.height_cm].filter((d) => d !== undefined && d !== null && String(d) !== "").length;
      if (dims > 0 && dims < 3) {
        for (const k of ["width_cm", "depth_cm", "height_cm"] as const) {
          if (v[k] === undefined || v[k] === null || String(v[k]) === "") ctx.addIssue({ code: "custom", path: [k], message: "Indiquez les trois dimensions, ou aucune." });
        }
      }
      if (dims === 0 && !v.size) {
        ctx.addIssue({ code: "custom", path: ["size"], message: "Indiquez une taille approximative ou les dimensions, pour estimer le volume." });
      }
    },
    // Contrôlé même si d'autres champs sont en erreur.
    { when: (p) => typeof p.value === "object" && p.value !== null },
  );

export const catalogItemSchema = z.object({
  catalog_key: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, { error: "Objet inconnu." }),
  category: z.enum(MANUAL_CATEGORY_KEYS, { error: "Choisissez une catégorie." }),
  quantity: integerField("La quantité", 1, 999),
  size: z.enum(SIZE_CLASS_VALUES, { error: "Choisissez une taille." }).optional(),
});

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
