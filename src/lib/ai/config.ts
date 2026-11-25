import "server-only";
import { AnthropicVisionProvider } from "./providers/anthropic";
import { SimulationProvider } from "./providers/simulation";
import type { VisionProvider } from "./provider";

/**
 * Choix du fournisseur d'analyse (variables d'environnement serveur, jamais NEXT_PUBLIC_) :
 * - AI_PROVIDER=anthropic + ANTHROPIC_API_KEY : vraie analyse, facturée par Anthropic au titulaire de la clé ;
 * - AI_PROVIDER=simulation + AI_ALLOW_SIMULATION=1 : simulateur de test, refusé hors base locale ;
 * - sinon : aucune analyse automatique (le déménageur établit l'inventaire à la main).
 * AI_MODEL est OBLIGATOIRE (aucun modèle imposé par défaut : le choix se fait d'après la comparaison réelle,
 * tests/ai-eval/) ; AI_EFFORT (low | medium | high, défaut medium).
 */
export type AiConfigStatus =
  | { ok: true; provider: VisionProvider }
  | { ok: false; reason: "not_configured" | "missing_key" | "missing_model" | "simulation_forbidden" };

/** Modèles évalués et dont le coût est connu (src/lib/ai/cost.ts). */
export const SUPPORTED_MODELS = ["claude-haiku-5-5", "claude-sonnet-5-5", "claude-opus-5-5"] as const;

function isLocalSupabase(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  return /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?(\/|$)/.test(url);
}

export function aiProvider(): AiConfigStatus {
  const choice = (process.env.AI_PROVIDER ?? "").trim().toLowerCase();
  if (choice === "anthropic") {
    const key = process.env.ANTHROPIC_API_KEY;
    if (!key || key.length < 20) return { ok: false, reason: "missing_key" };
    const model = process.env.AI_MODEL?.trim() ?? "";
    if (!(SUPPORTED_MODELS as readonly string[]).includes(model)) return { ok: false, reason: "missing_model" };
    const effort = process.env.AI_EFFORT === "low" || process.env.AI_EFFORT === "high" ? process.env.AI_EFFORT : "medium";
    return { ok: true, provider: new AnthropicVisionProvider(key, model, effort) };
  }
  if (choice === "simulation") {
    if (process.env.AI_ALLOW_SIMULATION !== "1" || process.env.VERCEL || !isLocalSupabase()) {
      return { ok: false, reason: "simulation_forbidden" };
    }
    return { ok: true, provider: new SimulationProvider() };
  }
  return { ok: false, reason: "not_configured" };
}
