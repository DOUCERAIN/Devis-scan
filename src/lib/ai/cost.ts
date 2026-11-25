/**
 * Tarifs publics de l'API Claude (USD par million de jetons), relevés le 24/11/2026
 * dans la documentation Anthropic (tarifs « premier niveau », hors offres partenaires).
 * À revérifier avant toute décision commerciale : https://platform.claude.com/docs/en/about-claude/pricing
 */
export const MODEL_PRICES_USD: Record<string, { input: number; output: number }> = {
  "claude-opus-5-5": { input: 4, output: 20 },
  "claude-sonnet-5-5": { input: 2, output: 10 },
  "claude-haiku-5-5": { input: 0.1, output: 0.5 },
};

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
 * Le plus petit coût réel possible (1 jeton lu en cache sur le modèle le moins cher : 1 × 0,1 × 0,10 $ / 1 000 000
 * = 0,00000001 $) est cent fois plus grand : un coût positif n'est donc jamais arrondi à zéro.
 * Doit rester égal à l'échelle de la colonne `analysis_runs.cost_usd` (numeric(16, 10)).
 */
export const COST_DECIMALS = 10;

/**
 * Coût estimé d'un appel. Lecture en cache : 0,1 × le prix d'entrée ; écriture en cache (5 min) : 1,25 ×.
 * Renvoie null pour un modèle absent de la table (le coût n'est alors pas inventé).
 * Le résultat est arrondi à COST_DECIMALS décimales, uniquement pour effacer le bruit des calculs à virgule.
 */
export function estimateCostUsd(model: string, usage: TokenUsage): number | null {
  const price = MODEL_PRICES_USD[model];
  if (!price) return null;
  const input = usage.inputTokens + usage.cacheReadTokens * 0.1 + usage.cacheWriteTokens * 1.25;
  const cost = (input * price.input + usage.outputTokens * price.output) / 1_000_000;
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
