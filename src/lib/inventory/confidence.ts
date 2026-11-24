/**
 * Niveaux de confiance de l'IA (charte graphique, section « Confiance de l'IA »).
 * Seuils de départ validés : à recalibrer après les tests sur de vrais logements.
 */
export const CONFIDENCE_THRESHOLDS = {
  /** Score minimal pour « Sûr ». */
  sure: 0.85,
  /** Score minimal pour « À vérifier » ; en dessous : « Incertain ». */
  verify: 0.6,
} as const;

export type ConfidenceLevel = "sure" | "verify" | "uncertain";

/** Niveau correspondant à un score de l'IA compris entre 0 et 1. */
export function confidenceLevel(
  score: number,
  thresholds: { sure: number; verify: number } = CONFIDENCE_THRESHOLDS,
): ConfidenceLevel {
  if (!Number.isFinite(score)) return "uncertain";
  if (score >= thresholds.sure) return "sure";
  if (score >= thresholds.verify) return "verify";
  return "uncertain";
}

export const CONFIDENCE_LABELS: Record<ConfidenceLevel, string> = {
  sure: "Sûr",
  verify: "À vérifier",
  uncertain: "Incertain",
};

/** « 68 % » : réservé à l'espace déménageur, jamais montré au particulier. */
export function formatScore(score: number): string {
  const pct = Math.round(Math.min(Math.max(score, 0), 1) * 100);
  return `${pct} %`;
}
