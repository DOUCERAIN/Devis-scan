import { emptyUsage } from "../cost.ts";
import type { DetectedObject } from "../output.ts";
import type { RoomInput, RoomResult, VisionProvider } from "../provider.ts";

/**
 * SIMULATEUR DE TEST — ce n'est pas une IA.
 * Renvoie un inventaire fixe selon le nom de la pièce, pour tester la chaîne complète
 * (enregistrement, volumes, devis, interfaces) sans appel payant.
 * N'est activable que par AI_PROVIDER=simulation + AI_ALLOW_SIMULATION=1 avec une base locale
 * (voir config.ts) ; les analyses produites sont marquées « simulated » et signalées à l'écran.
 */
const base = (o: Partial<DetectedObject> & Pick<DetectedObject, "label" | "catalog_id">): DetectedObject => ({
  quantity: 1,
  confidence: 0.9,
  visibility: "visible",
  image_indexes: [0],
  dimensions_cm: null,
  is_fragile: false,
  needs_disassembly: false,
  may_be_same_as: "",
  notes: "",
  ...o,
});

export const SIMULATED_ROOMS: Record<string, DetectedObject[]> = {
  salon: [
    base({ label: "Canapé trois places", catalog_id: "canape-3-places", confidence: 0.93, image_indexes: [0, 1] }),
    base({ label: "Table basse", catalog_id: "table-basse", confidence: 0.88 }),
    base({ label: "Meuble TV", catalog_id: "meuble-tv", confidence: 0.72, visibility: "partial" }),
    base({ label: "Lampe sur pied", catalog_id: "lampadaire", confidence: 0.45, visibility: "uncertain" }),
  ],
  cuisine: [
    base({ label: "Réfrigérateur", catalog_id: "refrigerateur", confidence: 0.95 }),
    base({ label: "Chaises", catalog_id: "chaise", quantity: 4, confidence: 0.8, image_indexes: [0, 1] }),
  ],
  chambre: [
    base({ label: "Lit double", catalog_id: "lit-double", confidence: 0.9, needs_disassembly: true }),
    base({ label: "Armoire deux portes", catalog_id: "armoire-2-portes", confidence: 0.86 }),
    base({ label: "Table de chevet", catalog_id: "table-de-chevet", quantity: 2, confidence: 0.66 }),
  ],
};

export class SimulationProvider implements VisionProvider {
  readonly id = "simulation" as const;
  readonly model = "simulation";
  readonly simulated = true;

  async analyzeRoom(input: RoomInput): Promise<RoomResult> {
    const name = input.roomName.toLowerCase();
    const key = Object.keys(SIMULATED_ROOMS).find((k) => name.includes(k));
    if (name.includes("échec simulé")) {
      return { ok: false, code: "provider_error", message: "Échec simulé.", usage: emptyUsage(), model: this.model };
    }
    const objects = (key ? SIMULATED_ROOMS[key] : []).map((o) => ({
      ...o,
      image_indexes: o.image_indexes.filter((i) => i < input.images.length),
    }));
    return { ok: true, analysis: { objects, room_notes: "Résultat simulé (test)." }, usage: emptyUsage(), model: this.model };
  }
}
