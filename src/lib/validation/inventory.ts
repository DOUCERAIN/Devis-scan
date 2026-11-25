import { z } from "zod";
import { integerField, requiredText } from "./common.ts";

const uuid = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, { error: "Identifiant invalide." });

/** Volume en m³ : accepte « 1,5 » ou « 1.5 », 3 décimales au plus. */
export const volumeField = z
  .string({ error: "Le volume est obligatoire." })
  .trim()
  .transform((v) => (v === "" ? Number.NaN : Number(v.replace(/\s/g, "").replace(",", "."))))
  .pipe(z.number({ error: "Le volume doit être un nombre." }).min(0, { error: "Le volume ne peut pas être négatif." }).max(100, { error: "Le volume ne doit pas dépasser 100 m³ par objet." }))
  .transform((n) => Math.round(n * 1000) / 1000);

/** not_duplicate / same_object : décision du déménageur sur un doublon possible (la réponse du client est conservée). */
export const ITEM_ACTIONS = ["save", "confirm", "remove", "restore", "not_duplicate", "same_object"] as const;

export const itemUpdateSchema = z
  .object({
    id: uuid,
    request_id: uuid,
    intent: z.enum(ITEM_ACTIONS, { error: "Action inconnue." }),
    name: requiredText(1, 120, "Le nom").optional(),
    quantity: integerField("La quantité", 1, 999).optional(),
    unit_volume_m3: volumeField.optional(),
    room_id: z.union([uuid, z.literal("")]).optional(),
  })
  .refine((v) => v.intent !== "save" || (v.name !== undefined && v.quantity !== undefined && v.unit_volume_m3 !== undefined), {
    error: "Renseignez le nom, la quantité et le volume.",
    path: ["name"],
  });

export const itemAddSchema = z.object({
  request_id: uuid,
  catalog_key: z.string().trim().max(120).optional(),
  name: requiredText(1, 120, "Le nom").optional(),
  quantity: integerField("La quantité", 1, 999),
  unit_volume_m3: z.union([volumeField, z.literal("").transform(() => undefined)]).optional(),
  room_id: z.union([uuid, z.literal("")]).optional(),
});

export type ItemUpdate = z.infer<typeof itemUpdateSchema>;

export const verificationSchema = z
  .object({
    request_id: uuid,
    intent: z.enum(["confirm", "correct"], { error: "Action inconnue." }),
    reason: z.string().trim().max(1000, { error: "1 000 caractères au plus." }).optional(),
  })
  .refine((v) => v.intent !== "correct" || (v.reason !== undefined && v.reason.length >= 5), {
    error: "Expliquez la raison de la modification (elle sera communiquée au client).",
    path: ["reason"],
  });
