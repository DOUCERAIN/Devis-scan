import type { ItemDraft } from "./postprocess.ts";

/**
 * Évaluation d'une analyse par rapport à un inventaire de référence annoté par une personne.
 * Sert à MESURER la qualité sur de vrais logements (aucun taux n'est publié sans cette mesure).
 */
export type ReferenceItem = { room: string; catalogKey: string; quantity: number };

export type Evaluation = {
  /** Objets de référence retrouvés (comptés à la quantité près) / objets de référence. */
  recall: number;
  /** Objets détectés corrects / objets détectés (hors doublons possibles, non comptés). */
  precision: number;
  /** Objets inventés (détectés, absents de la référence). */
  hallucinated: { room: string; key: string; quantity: number }[];
  /** Objets manqués. */
  missed: { room: string; key: string; quantity: number }[];
  /** Écart de volume compté par rapport au volume de référence (en m³, signé). */
  volumeErrorM3: number;
  /** Doublons possibles signalés à juste titre (l'objet n'existe pas en double dans la référence). */
  duplicatesFlaggedCorrectly: number;
};

const keyOf = (room: string, key: string) => `${room}\u0000${key}`;

export function evaluate(
  detected: Pick<ItemDraft, "roomId" | "catalogKey" | "name" | "quantity" | "possibleDuplicate" | "unitVolumeM3">[],
  reference: ReferenceItem[],
  volumes: Map<string, number>,
): Evaluation {
  const ref = new Map<string, number>();
  for (const r of reference) ref.set(keyOf(r.room, r.catalogKey), (ref.get(keyOf(r.room, r.catalogKey)) ?? 0) + r.quantity);
  const got = new Map<string, number>();
  let duplicatesFlaggedCorrectly = 0;
  let countedVolume = 0;
  for (const d of detected) {
    const k = keyOf(d.roomId, d.catalogKey ?? `autre:${d.name}`);
    if (d.possibleDuplicate) {
      if ((ref.get(k) ?? 0) <= (got.get(k) ?? 0)) duplicatesFlaggedCorrectly++;
      continue;
    }
    got.set(k, (got.get(k) ?? 0) + d.quantity);
    countedVolume += d.quantity * d.unitVolumeM3;
  }
  let matched = 0;
  const hallucinated: Evaluation["hallucinated"] = [];
  const missed: Evaluation["missed"] = [];
  for (const [k, q] of got) {
    const r = ref.get(k) ?? 0;
    matched += Math.min(q, r);
    const [room, key] = k.split("\u0000");
    if (q > r) hallucinated.push({ room, key, quantity: q - r });
  }
  for (const [k, r] of ref) {
    const q = got.get(k) ?? 0;
    const [room, key] = k.split("\u0000");
    if (r > q) missed.push({ room, key, quantity: r - q });
  }
  const refTotal = [...ref.values()].reduce((a, b) => a + b, 0);
  const gotTotal = [...got.values()].reduce((a, b) => a + b, 0);
  const refVolume = reference.reduce((s, r) => s + r.quantity * (volumes.get(r.catalogKey) ?? 0), 0);
  return {
    recall: refTotal === 0 ? 1 : matched / refTotal,
    precision: gotTotal === 0 ? 1 : matched / gotTotal,
    hallucinated,
    missed,
    volumeErrorM3: Math.round((countedVolume - refVolume) * 1000) / 1000,
    duplicatesFlaggedCorrectly,
  };
}
