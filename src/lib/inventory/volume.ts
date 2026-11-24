import { confidenceLevel, CONFIDENCE_THRESHOLDS } from "./confidence.ts";

/**
 * Un élément d'inventaire.
 * - `source: "ai"` : détecté par l'IA, avec un score de confiance.
 * - `source: "manual"` : ajouté par le particulier ou le déménageur.
 * `validatedByHuman` passe à vrai quand une personne confirme l'élément.
 * `possibleDuplicate` : l'IA pense avoir vu ce meuble dans une autre vidéo.
 */
export type InventoryItem = {
  id: string;
  name: string;
  room: string;
  quantity: number;
  unitVolumeM3: number;
  source: "ai" | "manual";
  confidence?: number;
  validatedByHuman?: boolean;
  possibleDuplicate?: boolean;
  removed?: boolean;
};

/** Catégorie d'un élément pour le calcul du volume. */
export type VolumeBucket = "confirmed" | "toVerify" | "potential";

/**
 * Règles (validées) :
 * - confirmé : validé par une personne, ajouté à la main, ou « Sûr » selon l'IA ;
 * - à vérifier : score entre les deux seuils ;
 * - potentiel : « Incertain » ou doublon possible non résolu. Il n'est PAS compté
 *   dans le volume estimé, seulement dans le haut de la fourchette.
 * Une validation humaine l'emporte toujours sur le score de l'IA.
 */
export function volumeBucket(
  item: InventoryItem,
  thresholds = CONFIDENCE_THRESHOLDS,
): VolumeBucket {
  if (item.source === "manual" || item.validatedByHuman) return "confirmed";
  if (item.possibleDuplicate) return "potential";
  const level = confidenceLevel(item.confidence ?? 0, thresholds);
  if (level === "sure") return "confirmed";
  if (level === "verify") return "toVerify";
  return "potential";
}

export type VolumeSummary = {
  /** Volume des éléments sûrs ou validés par une personne. */
  confirmedM3: number;
  /** Volume des éléments probables mais à vérifier. */
  toVerifyM3: number;
  /** Volume des éléments incertains ou doublons possibles (non compté). */
  potentialM3: number;
  /** Volume estimé = confirmé + à vérifier. C'est le bas de la fourchette. */
  estimatedM3: number;
  /** Haut de la fourchette = estimé + potentiel. */
  maxM3: number;
  /** Nombre d'éléments qu'une personne doit encore regarder. */
  itemsToReview: number;
  /** Vrai dès qu'un élément n'est ni sûr ni validé. */
  needsHumanReview: boolean;
};

const round1 = (n: number) => Math.round(n * 10) / 10;

export function summarizeVolume(
  items: readonly InventoryItem[],
  thresholds = CONFIDENCE_THRESHOLDS,
): VolumeSummary {
  let confirmed = 0;
  let toVerify = 0;
  let potential = 0;
  let itemsToReview = 0;

  for (const item of items) {
    if (item.removed) continue;
    const quantity = Math.max(0, Math.floor(item.quantity));
    const unit = Math.max(0, item.unitVolumeM3);
    const volume = quantity * unit;
    if (quantity === 0) continue;

    const bucket = volumeBucket(item, thresholds);
    if (bucket === "confirmed") confirmed += volume;
    else {
      itemsToReview += 1;
      if (bucket === "toVerify") toVerify += volume;
      else potential += volume;
    }
  }

  const confirmedM3 = round1(confirmed);
  const toVerifyM3 = round1(toVerify);
  const potentialM3 = round1(potential);
  const estimatedM3 = round1(confirmed + toVerify);
  return {
    confirmedM3,
    toVerifyM3,
    potentialM3,
    estimatedM3,
    maxM3: round1(confirmed + toVerify + potential),
    itemsToReview,
    needsHumanReview: itemsToReview > 0,
  };
}

/** « 18,4 m³ » avec virgule et espace insécable. */
export function formatVolume(m3: number): string {
  return `${m3.toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} m³`;
}
