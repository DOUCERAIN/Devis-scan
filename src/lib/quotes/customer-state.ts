/**
 * État des devis vu par le client : devis en vigueur (dernier accepté), version en attente de
 * réponse, et avenant. Un avenant n'est jamais considéré comme accepté d'office.
 */
export type QuoteLike = { id: string; version: number; status: string; amends_quote_id?: string | null };

export type CustomerQuoteState<Q extends QuoteLike> = {
  /** Dernier devis accepté : il reste le contrat en vigueur tant qu'un avenant n'est pas accepté. */
  inForce: Q | null;
  /** Version envoyée en attente de réponse (nouvelle version ou avenant). */
  pending: Q | null;
  /** Version à afficher en premier. */
  current: Q | null;
  /** Dernière version refusée, si elle est plus récente que le devis en vigueur. */
  lastRefused: Q | null;
};

export function customerQuoteState<Q extends QuoteLike>(quotes: readonly Q[]): CustomerQuoteState<Q> {
  const sorted = [...quotes].sort((a, b) => b.version - a.version);
  const inForce = sorted.find((q) => q.status === "accepted") ?? null;
  const pending = sorted.find((q) => q.status === "sent") ?? null;
  const refused = sorted.find((q) => q.status === "refused") ?? null;
  const lastRefused = refused && (!inForce || refused.version > inForce.version) ? refused : null;
  const latestVisible = sorted.find((q) => q.status !== "superseded") ?? null;
  return { inForce, pending, current: pending ?? inForce ?? latestVisible, lastRefused };
}
