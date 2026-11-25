/**
 * Modèles comparés par le banc (tests/ai-eval/bench.ts).
 * Identifiants vérifiés le 25/11/2026 dans la documentation officielle
 * (https://platform.claude.com/docs/en/about-claude/models/overview) : identifiant et alias identiques,
 * instantanés figés, sans date. Confirmé pour Haiku 5.5 par le nom renvoyé par l'API lors du test du 25/11/2026.
 */
export const BENCHMARK_MODELS = [
  { alias: "haiku", id: "claude-haiku-5-5", label: "Claude Haiku 5.5" },
  { alias: "sonnet", id: "claude-sonnet-5-5", label: "Claude Sonnet 5.5" },
  { alias: "opus", id: "claude-opus-5-5", label: "Claude Opus 5.5" },
] as const;

export type BenchmarkModelId = (typeof BENCHMARK_MODELS)[number]["id"];

/** « haiku,opus » → identifiants exacts ; lève une erreur pour tout modèle hors de la liste. */
export function resolveModels(list: string): BenchmarkModelId[] {
  const ids = list
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      const found = BENCHMARK_MODELS.find((m) => m.alias === s || m.id === s);
      if (!found) throw new Error(`Modèle non prévu par le banc : « ${s} » (autorisés : haiku, sonnet, opus).`);
      return found.id;
    });
  if (ids.length === 0) throw new Error("Aucun modèle demandé.");
  return [...new Set(ids)];
}

export function modelLabel(id: string): string {
  return BENCHMARK_MODELS.find((m) => m.id === id)?.label ?? id;
}
