import { MODEL_PRICES_USD, COST_DECIMALS } from "../cost.ts";

/**
 * Estimation PRUDENTE (majorante) des jetons d'un appel, sans appeler l'API.
 * Sert uniquement au garde-fou budgétaire : le coût réel est toujours recalculé ensuite
 * à partir des jetons facturés renvoyés par l'API (estimateCostUsd).
 */

/** Limites de taille des images (documentation « Vision », modèles Claude 4.7 et suivants). */
export const IMAGE_MAX_LONG_EDGE = 2576;
export const IMAGE_MAX_TOKENS = 4784;
/** Taille d'un « patch » visuel : une image coûte ⌈largeur / 28⌉ × ⌈hauteur / 28⌉ jetons. */
const PATCH = 28;

/** Jetons d'une image après le redimensionnement éventuel fait par l'API (borne haute). */
export function imageTokens(width: number, height: number): number {
  if (!(width > 0 && height > 0)) throw new Error("Dimensions d'image invalides.");
  const scale = Math.min(1, IMAGE_MAX_LONG_EDGE / Math.max(width, height));
  const w = Math.round(width * scale);
  const h = Math.round(height * scale);
  return Math.min(IMAGE_MAX_TOKENS, Math.ceil(w / PATCH) * Math.ceil(h / PATCH));
}

/** Majoration du texte : 1 jeton pour 2 caractères (le français en compte plutôt 3 à 4 par jeton). */
export const TEXT_CHARS_PER_TOKEN_UPPER_BOUND = 2;
/** Jetons ajoutés par l'API (sortie structurée, enveloppe des messages) : marge forfaitaire. */
export const FIXED_OVERHEAD_TOKENS = 1500;
/** Marge de sécurité supplémentaire sur l'ensemble de l'entrée. */
export const INPUT_SAFETY_FACTOR = 1.1;

export type CallShape = {
  images: { width: number; height: number }[];
  /** Nombre total de caractères de texte envoyés (consignes, catalogue, schéma, message). */
  textChars: number;
  /** Plafond de jetons en sortie (max_tokens), réflexion comprise. */
  maxOutputTokens: number;
};

export function worstCaseInputTokens(shape: CallShape): number {
  const images = shape.images.reduce((s, i) => s + imageTokens(i.width, i.height), 0);
  const text = Math.ceil(shape.textChars / TEXT_CHARS_PER_TOKEN_UPPER_BOUND);
  return Math.ceil((images + text + FIXED_OVERHEAD_TOKENS) * INPUT_SAFETY_FACTOR);
}

/**
 * Coût maximal d'un appel : toute l'entrée au tarif le plus cher qui puisse s'appliquer (écriture en cache,
 * palier « long prompt » si le seuil peut être franchi) + la sortie au plafond max_tokens.
 * L'API ne peut pas facturer plus de max_tokens en sortie : ce plafond est donc une borne sûre.
 */
export function worstCaseCallCostUsd(model: string, shape: CallShape): number {
  const pricing = MODEL_PRICES_USD[model];
  if (!pricing) throw new Error(`Modèle sans tarif connu : ${model}`);
  const input = worstCaseInputTokens(shape);
  const price = pricing.longPrompt && input > pricing.longPrompt.thresholdTokens ? pricing.longPrompt : pricing;
  const inputRate = Math.max(price.input, price.cacheWrite, price.cacheRead);
  const cost = (input * inputRate + shape.maxOutputTokens * price.output) / 1_000_000;
  // Arrondi vers le haut : la borne reste une borne.
  const factor = 10 ** COST_DECIMALS;
  return Math.ceil(cost * factor) / factor;
}
