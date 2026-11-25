import type { ItemDraft } from "./postprocess.ts";

/**
 * Évaluation d'une analyse par rapport à un inventaire de référence annoté par une personne.
 * Sert à MESURER la qualité sur de vrais logements (aucun taux n'est publié sans cette mesure).
 */
export type ReferenceItem = {
  room: string;
  catalogKey: string;
  quantity: number;
  /** Autres identifiants du catalogue acceptés pour cet objet. */
  alternatives?: string[];
  /** Objet ambigu ou minime : ni oubli s'il manque, ni erreur s'il est trouvé. */
  optional?: boolean;
};

export type Evaluation = {
  /** Objets de référence retrouvés (comptés à la quantité près) / objets de référence. */
  recall: number;
  /** Objets détectés corrects / objets détectés (doublons possibles compris : ils sont comptés « à vérifier »). */
  precision: number;
  /** Objets inventés (détectés, absents de la référence). */
  hallucinated: { room: string; key: string; quantity: number }[];
  /** Objets manqués. */
  missed: { room: string; key: string; quantity: number }[];
  /** Écart de volume compté par rapport au volume de référence (en m³, signé). */
  volumeErrorM3: number;
  /** Doublons possibles signalés à juste titre (l'objet était déjà compté en totalité : vrai surcomptage). */
  duplicatesFlaggedCorrectly: number;
};

const keyOf = (room: string, key: string) => `${room}\u0000${key}`;

export function evaluate(
  detected: Pick<ItemDraft, "roomId" | "catalogKey" | "name" | "quantity" | "possibleDuplicate" | "unitVolumeM3">[],
  reference: ReferenceItem[],
  volumes: Map<string, number>,
): Evaluation {
  const required = reference.filter((r) => !r.optional);
  const ref = new Map<string, number>();
  for (const r of required) ref.set(keyOf(r.room, r.catalogKey), (ref.get(keyOf(r.room, r.catalogKey)) ?? 0) + r.quantity);
  const optionalLeft = new Map<string, number>();
  const alias = new Map<string, string>();
  for (const r of reference) {
    for (const alt of r.alternatives ?? []) alias.set(keyOf(r.room, alt), keyOf(r.room, r.catalogKey));
    if (r.optional) optionalLeft.set(keyOf(r.room, r.catalogKey), (optionalLeft.get(keyOf(r.room, r.catalogKey)) ?? 0) + r.quantity);
  }
  const got = new Map<string, number>();
  let duplicatesFlaggedCorrectly = 0;
  let countedVolume = 0;
  // Doublons possibles traités en dernier : ils restent comptés, et sont « justifiés » si l'objet l'était déjà.
  for (const d of [...detected.filter((x) => !x.possibleDuplicate), ...detected.filter((x) => x.possibleDuplicate)]) {
    const raw = keyOf(d.roomId, d.catalogKey ?? `autre:${d.name}`);
    const k = alias.get(raw) ?? raw;
    if (d.possibleDuplicate && (ref.get(k) ?? 0) <= (got.get(k) ?? 0)) duplicatesFlaggedCorrectly++;
    countedVolume += d.quantity * d.unitVolumeM3;
    // Objets facultatifs trouvés : sortis du calcul (dans la limite de la quantité de référence).
    let quantity = d.quantity;
    const opt = optionalLeft.get(k) ?? 0;
    if (opt > 0 && !ref.has(k)) {
      const used = Math.min(opt, quantity);
      optionalLeft.set(k, opt - used);
      quantity -= used;
    }
    if (quantity > 0) got.set(k, (got.get(k) ?? 0) + quantity);
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
  const refVolume = required.reduce((s, r) => s + r.quantity * (volumes.get(r.catalogKey) ?? 0), 0);
  return {
    recall: refTotal === 0 ? 1 : matched / refTotal,
    precision: gotTotal === 0 ? 1 : matched / gotTotal,
    hallucinated,
    missed,
    volumeErrorM3: Math.round((countedVolume - refVolume) * 1000) / 1000,
    duplicatesFlaggedCorrectly,
  };
}
