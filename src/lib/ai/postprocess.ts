import type { DetectedObject } from "./output.ts";

/** Référence du catalogue utile au post-traitement (lue en base : public.furniture_catalog). */
export type CatalogRef = {
  id: string;
  name: string;
  synonyms: string[];
  heavy: boolean;
  handling: string;
  moving_volume_min: number | null;
  moving_volume_avg: number | null;
  moving_volume_max: number | null;
  geometric_volume_avg: number | null;
};

/** Coefficients de manutention (identiques à scripts/catalog/build_catalog.py, hypothèses à calibrer). */
export const HANDLING_COEFFICIENTS: Record<string, number> = {
  rigide: 1.1,
  rembourre: 1.15,
  empilable: 0.7,
  demontable: 0.45,
  fragile: 1.3,
};

/** Seuil au-delà duquel un volume calculé depuis des dimensions estimées n'est jamais présenté comme « sûr ». */
export const DIMENSION_BASED_MAX_CONFIDENCE = 0.84;

/** Objets qu'un logement possède rarement en double : deux occurrences dans deux pièces → doublon possible. */
const USUALLY_SINGLE = new Set([
  "refrigerateur",
  "refrigerateur-americain",
  "lave-linge",
  "seche-linge",
  "lave-vaisselle",
  "cuisiniere",
  "piano-droit",
  "piano-a-queue",
  "billard",
  "baby-foot",
  "table-de-ping-pong",
]);

export type RoomDetections = { roomId: string; objects: DetectedObject[]; frameIds: string[] };

export type ItemDraft = {
  key: string;
  roomId: string;
  name: string;
  aiLabel: string;
  catalogKey: string | null;
  category: string | null;
  quantity: number;
  unitVolumeM3: number;
  unitVolumeMinM3: number | null;
  unitVolumeMaxM3: number | null;
  geometricVolumeM3: number | null;
  volumeSource: "catalog" | "dimensions" | "unknown";
  confidence: number;
  visibility: DetectedObject["visibility"];
  isHeavy: boolean;
  isFragile: boolean;
  needsDisassembly: boolean;
  possibleDuplicate: boolean;
  duplicateOfKey: string | null;
  frameIds: string[];
  dims: { width: number; depth: number; height: number } | null;
  notes: string | null;
  aiProposal: DetectedObject;
};

const round3 = (n: number) => Math.round(n * 1000) / 1000;

export function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Rattache un objet au catalogue : identifiant proposé par le modèle s'il existe,
 * sinon correspondance exacte du nom ou d'un synonyme. Jamais de rapprochement approximatif.
 */
export function matchCatalog(object: Pick<DetectedObject, "catalog_id" | "label">, catalog: Map<string, CatalogRef>): CatalogRef | null {
  const byId = catalog.get(object.catalog_id.trim().toLowerCase());
  if (byId) return byId;
  const label = normalize(object.label);
  for (const ref of catalog.values()) {
    if (normalize(ref.name) === label || ref.synonyms.some((s) => normalize(s) === label)) return ref;
  }
  return null;
}

/**
 * Volume de déménagement unitaire :
 * 1. catalogue (volume de déménagement de référence) ;
 * 2. sinon dimensions estimées sur l'image × coefficient de manutention (incertain par nature) ;
 * 3. sinon inconnu (0, à renseigner par le déménageur : rien n'est inventé).
 */
export function unitVolume(
  ref: CatalogRef | null,
  dims: DetectedObject["dimensions_cm"],
): Pick<ItemDraft, "unitVolumeM3" | "unitVolumeMinM3" | "unitVolumeMaxM3" | "geometricVolumeM3" | "volumeSource"> {
  const geometric = dims ? round3((dims.width * dims.depth * dims.height) / 1_000_000) : ref?.geometric_volume_avg ?? null;
  if (ref && ref.moving_volume_avg !== null) {
    return {
      unitVolumeM3: ref.moving_volume_avg,
      unitVolumeMinM3: ref.moving_volume_min,
      unitVolumeMaxM3: ref.moving_volume_max,
      geometricVolumeM3: geometric,
      volumeSource: "catalog",
    };
  }
  if (dims && geometric !== null) {
    const coefficient = HANDLING_COEFFICIENTS[ref?.handling ?? "rigide"] ?? 1.1;
    const volume = Math.min(100, round3(geometric * coefficient));
    return {
      unitVolumeM3: volume,
      unitVolumeMinM3: round3(volume * 0.7),
      unitVolumeMaxM3: round3(volume * 1.3),
      geometricVolumeM3: geometric,
      volumeSource: "dimensions",
    };
  }
  return { unitVolumeM3: 0, unitVolumeMinM3: null, unitVolumeMaxM3: null, geometricVolumeM3: geometric, volumeSource: "unknown" };
}

/** Recouvrement des images où deux objets ont été vus (indice de Jaccard). */
function overlap(a: number[], b: number[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const setB = new Set(b);
  const inter = a.filter((x) => setB.has(x)).length;
  return inter / new Set([...a, ...b]).size;
}

/**
 * Transforme les détections brutes en éléments d'inventaire.
 * Dédoublonnage :
 * - dans une pièce, le modèle regroupe déjà un même objet vu sur plusieurs images ; si deux entrées
 *   restent avec la même référence et des images largement communes (≥ 50 %), la seconde est marquée
 *   « doublon possible » (non comptée, décision humaine) ;
 * - entre pièces, un objet rarement présent deux fois (réfrigérateur, lave-linge, piano…) vu dans
 *   deux pièces, ou signalé par le modèle (« may_be_same_as »), est marqué « doublon possible ».
 * Rien n'est supprimé automatiquement.
 */
export function buildItems(rooms: RoomDetections[], catalog: Map<string, CatalogRef>): ItemDraft[] {
  const items: ItemDraft[] = [];
  const seenSingle = new Map<string, string>();

  rooms.forEach((room, roomIndex) => {
    const roomItems: (ItemDraft & { imageIndexes: number[] })[] = [];
    room.objects.forEach((object, objectIndex) => {
      const ref = matchCatalog(object, catalog);
      const volume = unitVolume(ref, object.dimensions_cm);
      let confidence = object.confidence;
      if (volume.volumeSource !== "catalog") confidence = Math.min(confidence, DIMENSION_BASED_MAX_CONFIDENCE);
      if (object.visibility === "uncertain") confidence = Math.min(confidence, 0.59);
      const item: ItemDraft & { imageIndexes: number[] } = {
        key: `${roomIndex}:${objectIndex}`,
        roomId: room.roomId,
        name: ref?.name ?? object.label,
        aiLabel: object.label,
        catalogKey: ref?.id ?? null,
        category: null,
        quantity: object.quantity,
        ...volume,
        confidence: Math.round(confidence * 1000) / 1000,
        visibility: object.visibility,
        isHeavy: ref?.heavy ?? false,
        isFragile: object.is_fragile || ref?.handling === "fragile",
        needsDisassembly: object.needs_disassembly,
        possibleDuplicate: false,
        duplicateOfKey: null,
        frameIds: object.image_indexes.map((i) => room.frameIds[i]).filter(Boolean),
        imageIndexes: object.image_indexes,
        dims: object.dimensions_cm,
        notes: object.notes || null,
        aiProposal: object,
      };

      const twin = roomItems.find(
        (other) => !other.possibleDuplicate && other.catalogKey !== null && other.catalogKey === item.catalogKey && overlap(other.imageIndexes, item.imageIndexes) >= 0.5,
      );
      if (twin) {
        item.possibleDuplicate = true;
        item.duplicateOfKey = twin.key;
      } else if (item.catalogKey && USUALLY_SINGLE.has(item.catalogKey)) {
        const first = seenSingle.get(item.catalogKey);
        if (first && !first.startsWith(`${roomIndex}:`)) {
          item.possibleDuplicate = true;
          item.duplicateOfKey = first;
        } else if (!first) {
          seenSingle.set(item.catalogKey, item.key);
        }
      }
      if (!item.possibleDuplicate && object.may_be_same_as.trim() !== "") {
        item.possibleDuplicate = true;
      }
      roomItems.push(item);
    });
    for (const roomItem of roomItems) {
      const item: ItemDraft & { imageIndexes?: number[] } = { ...roomItem };
      delete item.imageIndexes;
      items.push(item);
    }
  });

  return items;
}
