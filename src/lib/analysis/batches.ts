import type { DetectedObject } from "../ai/output.ts";

/**
 * Analyse de l'ensemble du logement (parcours v3 : une ou plusieurs vidéos, des photos, sans pièce imposée).
 *
 * Les images de tous les médias sont prises dans l'ordre de prise de vue, réparties uniformément (au plus
 * MAX_HOME_IMAGES, maîtrise du coût) puis découpées en lots de HOME_BATCH_SIZE images au plus : chaque lot est
 * analysé en un seul appel, où le modèle regroupe lui-même les vues d'un même meuble.
 *
 * Les résultats des lots sont ensuite réunis comme UNE seule pièce (indices d'images décalés) : la règle de
 * post-traitement « même référence précise jamais visible sur une même image » signale alors comme doublon
 * possible un meuble repéré dans deux lots. Rien n'est retiré automatiquement : le client puis le déménageur
 * tranchent (règle de dédoublonnage validée, src/lib/ai/postprocess.ts). Module pur (node --test).
 */
export const MAX_HOME_IMAGES = 60;
export const HOME_BATCH_SIZE = 20;

/** Répartit uniformément au plus `max` éléments en conservant l'ordre. */
export function spreadEvenly<T>(items: T[], max: number): T[] {
  if (items.length <= max) return items;
  return Array.from({ length: max }, (_, i) => items[Math.floor((i * items.length) / max)]);
}

/** Lots de taille équilibrée (20, 20, 20 plutôt que 20, 20, 1), dans l'ordre. */
export function chunkBalanced<T>(items: T[], size = HOME_BATCH_SIZE): T[][] {
  if (items.length === 0) return [];
  const count = Math.ceil(items.length / size);
  const base = Math.floor(items.length / count);
  const extra = items.length % count;
  const out: T[][] = [];
  let start = 0;
  for (let i = 0; i < count; i++) {
    const n = base + (i < extra ? 1 : 0);
    out.push(items.slice(start, start + n));
    start += n;
  }
  return out;
}

export type FrameRef = { id: string; storage_path: string; captured_at_ms: number | null; videoCreatedAt: string };

/** Ordre de prise de vue : média par média (ordre d'envoi), puis instant dans la vidéo. */
export function orderHomeFrames<T extends FrameRef>(frames: T[]): T[] {
  return [...frames].sort((a, b) => a.videoCreatedAt.localeCompare(b.videoCreatedAt) || (a.captured_at_ms ?? 0) - (b.captured_at_ms ?? 0));
}

export function planHomeBatches<T extends FrameRef>(frames: T[], maxImages = MAX_HOME_IMAGES, batchSize = HOME_BATCH_SIZE): T[][] {
  return chunkBalanced(spreadEvenly(orderHomeFrames(frames), maxImages), batchSize);
}

/**
 * Réunit les détections de plusieurs lots en une seule liste : les indices d'images (et l'indice de l'autre
 * entrée d'un doute d'identité) sont décalés pour rester valides dans l'ensemble.
 */
export function mergeBatchDetections(batches: { objects: DetectedObject[]; frameIds: string[] }[]): { objects: DetectedObject[]; frameIds: string[] } {
  const objects: DetectedObject[] = [];
  const frameIds: string[] = [];
  for (const batch of batches) {
    const imageOffset = frameIds.length;
    const objectOffset = objects.length;
    for (const o of batch.objects) {
      objects.push({
        ...o,
        image_indexes: o.image_indexes.map((i) => i + imageOffset),
        identity_doubt: o.identity_doubt
          ? { ...o.identity_doubt, other_entry_index: o.identity_doubt.other_entry_index === null ? null : o.identity_doubt.other_entry_index + objectOffset }
          : null,
      });
    }
    frameIds.push(...batch.frameIds);
  }
  return { objects, frameIds };
}
