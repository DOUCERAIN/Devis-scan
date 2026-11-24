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
 * Coût estimé d'un appel. Lecture en cache : 0,1 × le prix d'entrée ; écriture en cache (5 min) : 1,25 ×.
 * Renvoie null pour un modèle absent de la table (le coût n'est alors pas inventé).
 */
export function estimateCostUsd(model: string, usage: TokenUsage): number | null {
  const price = MODEL_PRICES_USD[model];
  if (!price) return null;
  const input = usage.inputTokens + usage.cacheReadTokens * 0.1 + usage.cacheWriteTokens * 1.25;
  return Math.round(((input * price.input + usage.outputTokens * price.output) / 1_000_000) * 100000) / 100000;
}
