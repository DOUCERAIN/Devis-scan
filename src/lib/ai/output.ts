import { z } from "zod";

/**
 * Format de réponse demandé au modèle pour UNE pièce (plusieurs images de la même pièce).
 * Le schéma JSON (structured outputs) garantit la forme ; zod revérifie côté serveur
 * (bornes numériques, cohérence) car le schéma JSON de l'API n'accepte pas min/max.
 */
export const VISIBILITY = ["visible", "partial", "uncertain"] as const;

export const detectedObjectSchema = z.object({
  label: z.string().trim().min(1).max(120),
  catalog_id: z.string().trim().max(120),
  quantity: z.number().int().min(1).max(200),
  confidence: z.number().min(0).max(1),
  visibility: z.enum(VISIBILITY),
  image_indexes: z.array(z.number().int().min(0).max(63)).max(64),
  dimensions_cm: z
    .object({ width: z.number().positive().max(2000), depth: z.number().positive().max(2000), height: z.number().positive().max(2000) })
    .nullable(),
  is_fragile: z.boolean(),
  needs_disassembly: z.boolean(),
  /** Ancien champ libre (réponses antérieures au 26/11/2026) : conservé pour relire les analyses existantes. */
  may_be_same_as: z.string().trim().max(200).default(""),
  /** Position du meuble dans la pièce (mur, coin, voisinage). Indice d'identité physique. */
  location_in_room: z.string().trim().max(200).default(""),
  /** Signes distinctifs de CET exemplaire (couleur, matière, usure, objets posés dessus…). */
  distinctive_features: z.string().trim().max(200).default(""),
  /**
   * Doute explicite du modèle : cette entrée est peut-être le même objet physique qu'une autre entrée
   * de la même pièce (other_entry_index) ou qu'un objet d'une autre pièce (other_room). null si aucun doute.
   */
  identity_doubt: z
    .object({
      other_entry_index: z.number().int().min(0).max(149).nullable(),
      other_room: z.boolean(),
      reason: z.string().trim().min(1).max(300),
    })
    .nullable()
    .default(null),
  notes: z.string().trim().max(500),
});

export const roomAnalysisSchema = z.object({
  objects: z.array(detectedObjectSchema).max(150),
  room_notes: z.string().trim().max(1000),
});

export type DetectedObject = z.infer<typeof detectedObjectSchema>;
export type RoomAnalysis = z.infer<typeof roomAnalysisSchema>;

/** Schéma JSON envoyé à l'API (sans contraintes numériques, non prises en charge). */
export const ROOM_ANALYSIS_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["objects", "room_notes"],
  properties: {
    objects: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "label",
          "catalog_id",
          "quantity",
          "confidence",
          "visibility",
          "image_indexes",
          "dimensions_cm",
          "is_fragile",
          "needs_disassembly",
          "location_in_room",
          "distinctive_features",
          "identity_doubt",
          "notes",
        ],
        properties: {
          label: { type: "string", description: "Nom de l'objet en français" },
          catalog_id: { type: "string", description: "Identifiant du catalogue, ou \"autre\" si aucun ne convient" },
          quantity: { type: "integer" },
          confidence: { type: "number", description: "Entre 0 et 1" },
          visibility: { type: "string", enum: [...VISIBILITY] },
          image_indexes: { type: "array", items: { type: "integer" } },
          dimensions_cm: {
            anyOf: [
              {
                type: "object",
                additionalProperties: false,
                required: ["width", "depth", "height"],
                properties: { width: { type: "number" }, depth: { type: "number" }, height: { type: "number" } },
              },
              { type: "null" },
            ],
          },
          is_fragile: { type: "boolean" },
          needs_disassembly: { type: "boolean" },
          location_in_room: { type: "string", description: "Position dans la pièce : mur, coin, à côté de quoi" },
          distinctive_features: { type: "string", description: "Signes distinctifs de cet exemplaire précis" },
          identity_doubt: {
            anyOf: [
              {
                type: "object",
                additionalProperties: false,
                required: ["other_entry_index", "other_room", "reason"],
                properties: {
                  other_entry_index: { anyOf: [{ type: "integer" }, { type: "null" }], description: "Indice (à partir de 0) de l'autre entrée de cette réponse, ou null" },
                  other_room: { type: "boolean", description: "Vrai si l'autre objet est probablement dans une autre pièce" },
                  reason: { type: "string" },
                },
              },
              { type: "null" },
            ],
          },
          notes: { type: "string" },
        },
      },
    },
    room_notes: { type: "string" },
  },
} as const;

/** Analyse le texte JSON renvoyé par un fournisseur. Lève une erreur si la forme est invalide. */
export function parseRoomAnalysis(text: string, imageCount: number): RoomAnalysis {
  const data = roomAnalysisSchema.parse(JSON.parse(text));
  return {
    ...data,
    objects: data.objects.map((o, index) => ({
      ...o,
      // Indices d'images hors limites ignorés (jamais d'association inventée).
      image_indexes: [...new Set(o.image_indexes)].filter((i) => i < imageCount),
      // Renvoi vers une entrée inexistante ou vers elle-même : ignoré (jamais d'association inventée).
      identity_doubt:
        o.identity_doubt && o.identity_doubt.other_entry_index !== null && (o.identity_doubt.other_entry_index >= data.objects.length || o.identity_doubt.other_entry_index === index)
          ? { ...o.identity_doubt, other_entry_index: null }
          : o.identity_doubt,
    })),
  };
}
