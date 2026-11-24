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
  may_be_same_as: z.string().trim().max(200),
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
          "may_be_same_as",
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
          may_be_same_as: { type: "string", description: "Vide, ou explication d'un doublon possible" },
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
    objects: data.objects.map((o) => ({
      ...o,
      // Indices d'images hors limites ignorés (jamais d'association inventée).
      image_indexes: [...new Set(o.image_indexes)].filter((i) => i < imageCount),
    })),
  };
}
