/**
 * Tarifs publics de l'API Claude (USD par million de jetons), vérifiés le 25/11/2026 sur
 * https://platform.claude.com/docs/en/about-claude/pricing (API Anthropic directe, hors offres partenaires,
 * sans le supplément de 1,1 × de la résidence des données aux États-Unis, non utilisée).
 * - cacheWrite : écriture en cache 5 minutes (durée utilisée par le projet, cache_control « ephemeral »).
 * - cacheRead : lecture en cache (0,05 × l'entrée pour Opus 5.5 et Sonnet 5.5, 0,1 × pour Haiku 5.5).
 * - longPrompt (Haiku 5.5 uniquement) : au-delà de 100 000 jetons d'entrée (cache compris), TOUTE la requête
 *   est facturée au tarif supérieur.
 * À revérifier avant toute décision commerciale.
 */
export type ModelPrice = { input: number; output: number; cacheWrite: number; cacheRead: number };
export type ModelPricing = ModelPrice & { longPrompt?: { thresholdTokens: number } & ModelPrice };

export const PRICES_CHECKED_AT = "2026-11-25";

export const MODEL_PRICES_USD: Record<string, ModelPricing> = {
  "claude-opus-5-5": { input: 4, output: 20, cacheWrite: 5, cacheRead: 0.2 },
  "claude-sonnet-5-5": { input: 2, output: 10, cacheWrite: 2.5, cacheRead: 0.1 },
  "claude-haiku-5-5": {
    input: 0.1,
    output: 0.5,
    cacheWrite: 0.125,
    cacheRead: 0.01,
    longPrompt: { thresholdTokens: 100_000, input: 0.5, output: 2.5, cacheWrite: 0.625, cacheRead: 0.05 },
  },
};

/** Tarif applicable à une requête (palier « long prompt » de Haiku 5.5 compris). */
export function priceFor(model: string, promptTokens: number): ModelPrice | null {
  const pricing = MODEL_PRICES_USD[model];
  if (!pricing) return null;
  if (pricing.longPrompt && promptTokens > pricing.longPrompt.thresholdTokens) return pricing.longPrompt;
  return pricing;
}

export type TokenUsage = {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
};

export const emptyUsage = (): TokenUsage => ({ inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 });

export function addUsage(a: TokenUsage, b: TokenUsage): TokenUsage {
  return {
    inputTokens: a.inputTokens + b.inputTokens,
    outputTokens: a.outputTokens + b.outputTokens,
    cacheReadTokens: a.cacheReadTokens + b.cacheReadTokens,
    cacheWriteTokens: a.cacheWriteTokens + b.cacheWriteTokens,
  };
}

/**
 * Précision du coût calculé et enregistré : 10 décimales (un dix-milliardième de dollar).
 * Le plus petit coût réel possible (1 jeton lu en cache sur Haiku 5.5 : 1 × 0,01 $ / 1 000 000
 * = 0,00000001 $) est cent fois plus grand : un coût positif n'est donc jamais arrondi à zéro.
 * Doit rester égal à l'échelle de la colonne `analysis_runs.cost_usd` (numeric(16, 10)).
 */
export const COST_DECIMALS = 10;

/**
 * Coût estimé d'un appel, à partir des jetons réellement facturés renvoyés par l'API.
 * Renvoie null pour un modèle absent de la table (le coût n'est alors pas inventé).
 * Le résultat est arrondi à COST_DECIMALS décimales, uniquement pour effacer le bruit des calculs à virgule.
 */
export function estimateCostUsd(model: string, usage: TokenUsage): number | null {
  const promptTokens = usage.inputTokens + usage.cacheReadTokens + usage.cacheWriteTokens;
  const price = priceFor(model, promptTokens);
  if (!price) return null;
  const cost =
    (usage.inputTokens * price.input +
      usage.cacheWriteTokens * price.cacheWrite +
      usage.cacheReadTokens * price.cacheRead +
      usage.outputTokens * price.output) /
    1_000_000;
  return Number(cost.toFixed(COST_DECIMALS));
}

/**
 * Affichage d'un coût en dollars, au format français (« 0,0000047 $ », « 0,0215 $ », « 12,35 $ »).
 * - Moins de 1 $ : 3 chiffres significatifs, donc un coût positif n'est jamais affiché « 0 $ ».
 * - 1 $ ou plus : 2 décimales au plus.
 * - null ou valeur invalide : « coût inconnu » (jamais un montant inventé).
 */
export function formatCostUsd(cost: number | null | undefined): string {
  if (cost === null || cost === undefined || !Number.isFinite(cost) || cost < 0) return "coût inconnu";
  if (cost === 0) return "0 $";
  const options: Intl.NumberFormatOptions = cost < 1 ? { maximumSignificantDigits: 3 } : { maximumFractionDigits: 2 };
  return `${new Intl.NumberFormat("fr-FR", { ...options, useGrouping: true }).format(cost)} $`;
}
