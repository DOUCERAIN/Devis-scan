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

/**
 * Références du catalogue trop génériques pour servir d'indice d'identité : deux « Autre objet » ou deux
 * « Sac ou ballot » sont presque toujours deux objets différents. Jamais comparées entre elles.
 */
export const GENERIC_IDENTITY_KEYS = new Set(["autre-objet", "sac-ou-ballot"]);

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
  /**
   * Doublon possible : peut-être le même objet physique qu'un autre élément. L'élément reste COMPTÉ
   * (« à vérifier ») et attend une décision humaine ; rien n'est retiré automatiquement.
   */
  possibleDuplicate: boolean;
  duplicateOfKey: string | null;
  /** Indices qui ont conduit au signalement, en français, pour le déménageur. */
  duplicateReason: string | null;
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

const shareImage = (a: number[], b: number[]) => a.some((x) => b.includes(x));
const describe = (o: DetectedObject) => [o.location_in_room, o.distinctive_features].filter(Boolean).join(", ") || "non précisé";

/**
 * Transforme les détections brutes en éléments d'inventaire, SANS JAMAIS rien retirer.
 *
 * Distinguer « plusieurs objets identiques » de « un objet vu plusieurs fois » demande de voir les images :
 * c'est le modèle qui regroupe les vues d'un même objet (consignes : position, orientation, voisinage,
 * signes distinctifs, continuité). Le post-traitement ne fait que signaler les cas où un doute subsiste :
 * - doute explicite du modèle (identity_doubt) ;
 * - dans une pièce, deux entrées de même référence précise jamais visibles sur une même image
 *   (peut-être le même meuble filmé à deux moments). Deux entrées visibles ensemble sur une image
 *   sont deux objets distincts : aucun signalement ;
 * - entre pièces, un objet que le modèle pense avoir vu dans une autre pièce, si un objet de même
 *   référence y a été repéré.
 * La référence seule (même catégorie, même nom, ressemblance) ne suffit jamais, et les références
 * génériques (« Autre objet », « Sac ou ballot ») ne sont jamais comparées.
 * Un doublon possible reste compté dans le volume (« à vérifier ») jusqu'à la décision du déménageur.
 */
export function buildItems(rooms: RoomDetections[], catalog: Map<string, CatalogRef>): ItemDraft[] {
  type Work = ItemDraft & { imageIndexes: number[]; roomIndex: number; objectIndex: number };
  const byRoom: Work[][] = rooms.map((room, roomIndex) =>
    room.objects.map((object, objectIndex) => {
      const ref = matchCatalog(object, catalog);
      const volume = unitVolume(ref, object.dimensions_cm);
      let confidence = object.confidence;
      if (volume.volumeSource !== "catalog") confidence = Math.min(confidence, DIMENSION_BASED_MAX_CONFIDENCE);
      if (object.visibility === "uncertain") confidence = Math.min(confidence, 0.59);
      return {
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
        duplicateReason: null,
        frameIds: object.image_indexes.map((i) => room.frameIds[i]).filter(Boolean),
        imageIndexes: object.image_indexes,
        dims: object.dimensions_cm,
        notes: object.notes || null,
        aiProposal: object,
        roomIndex,
        objectIndex,
      };
    }),
  );
  const flag = (item: Work, other: Work | null, reason: string) => {
    if (item.possibleDuplicate) return;
    item.possibleDuplicate = true;
    item.duplicateOfKey = other?.key ?? null;
    item.duplicateReason = reason.slice(0, 500);
  };
  const specific = (item: Work) => item.catalogKey !== null && !GENERIC_IDENTITY_KEYS.has(item.catalogKey);

  // 1. Doute explicite du modèle sur une autre entrée de la même pièce.
  for (const items of byRoom) {
    for (const item of items) {
      const doubt = item.aiProposal.identity_doubt;
      if (!doubt || doubt.other_room) continue;
      const other = doubt.other_entry_index === null ? null : items[doubt.other_entry_index] ?? null;
      flag(item, other, `Doute signalé par l'IA : ${doubt.reason}`);
    }
  }

  // 2. Même pièce, même référence précise, jamais visibles ensemble.
  for (const items of byRoom) {
    items.forEach((b, j) => {
      if (b.possibleDuplicate || !specific(b)) return;
      const a = items.slice(0, j).find((x) => x.catalogKey === b.catalogKey && !(x.imageIndexes.length > 0 && b.imageIndexes.length > 0 && shareImage(x.imageIndexes, b.imageIndexes)));
      if (!a) return;
      const why = a.imageIndexes.length === 0 || b.imageIndexes.length === 0
        ? "images non précisées par l'IA"
        : "jamais visibles ensemble sur une même image";
      flag(b, a, `Même type de meuble (${b.name}) que « ${a.aiLabel} », ${why} : il peut s'agir du même meuble filmé à deux moments. Positions : « ${describe(a.aiProposal)} » / « ${describe(b.aiProposal)} ».`);
    });
  }

  // 3. Objet que le modèle pense avoir vu dans une autre pièce.
  for (const items of byRoom) {
    for (const item of items) {
      const doubt = item.aiProposal.identity_doubt;
      const legacy = !doubt && item.aiProposal.may_be_same_as.trim() !== "" ? item.aiProposal.may_be_same_as.trim() : null;
      if (!(doubt?.other_room || legacy)) continue;
      const elsewhere = specific(item) ? byRoom.flat().find((x) => x.roomIndex !== item.roomIndex && x.catalogKey === item.catalogKey) : undefined;
      const reason = doubt?.reason ?? legacy ?? "";
      if (elsewhere) flag(item, elsewhere, `L'IA pense avoir peut-être vu ce meuble dans une autre pièce : ${reason}`);
      // Ancien champ libre sans objet correspondant ailleurs : simple remarque, pas un doublon
      // (il contenait parfois une position, par exemple « probablement dans l'entrée »).
      else if (doubt) flag(item, null, `L'IA pense avoir peut-être vu ce meuble dans une autre pièce : ${reason} (aucun meuble du même type repéré ailleurs).`);
    }
  }

  return byRoom.flat().map((item) => {
    const out: ItemDraft & { imageIndexes?: number[]; roomIndex?: number; objectIndex?: number } = { ...item };
    delete out.imageIndexes;
    delete out.roomIndex;
    delete out.objectIndex;
    return out;
  });
}
