import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { createAnthropicClient } from "../anthropic-client.ts";
import { ANALYSIS_INSTRUCTIONS, roomPrompt } from "../prompt.ts";
import { parseRoomAnalysis, ROOM_ANALYSIS_JSON_SCHEMA } from "../output.ts";
import { emptyUsage, type TokenUsage } from "../cost.ts";
import type { RoomInput, RoomResult, VisionProvider } from "../provider.ts";

type Effort = "low" | "medium" | "high";

/** Modèles acceptant le paramètre `fallbacks` (repli serveur après un refus de sécurité). */
export function supportsFallback(model: string): boolean {
  return /^claude-(opus-5-5|sonnet-5-5|opus-5|fable-5)/.test(model);
}

/**
 * Analyse par Claude (API Anthropic), appelée uniquement côté serveur.
 * - sortie structurée (output_config.format) puis revalidation zod ;
 * - consignes + catalogue mis en cache (cache_control) pour réduire le coût des pièces suivantes ;
 * - repli automatique en cas de refus de sécurité (fallbacks « default »).
 */
export class AnthropicVisionProvider implements VisionProvider {
  readonly id = "anthropic" as const;
  readonly simulated = false;
  readonly model: string;
  private readonly effort: Effort;
  private readonly client: Anthropic;

  constructor(apiKey: string, model: string, effort: Effort) {
    this.model = model;
    this.effort = effort;
    this.client = createAnthropicClient(apiKey, { maxRetries: 3, timeout: 180_000 });
  }

  async analyzeRoom(input: RoomInput): Promise<RoomResult> {
    const content: Anthropic.Beta.BetaContentBlockParam[] = input.images.map((image) => ({
      type: "image",
      source: { type: "base64", media_type: image.mediaType, data: image.base64 },
    }));
    content.push({ type: "text", text: roomPrompt({ name: input.roomName, description: input.roomDescription }, input.images.length) });

    let usage: TokenUsage = emptyUsage();
    try {
      const response = await this.client.beta.messages.create({
        model: this.model,
        max_tokens: 16000,
        // Repli serveur en cas de refus : disponible pour Opus 5.5 et Sonnet 5.5, pas pour Haiku 5.5.
        ...(supportsFallback(this.model) ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const } : {}),
        system: [
          { type: "text", text: ANALYSIS_INSTRUCTIONS },
          { type: "text", text: input.catalogText, cache_control: { type: "ephemeral" } },
        ],
        output_config: { effort: this.effort, format: { type: "json_schema", schema: ROOM_ANALYSIS_JSON_SCHEMA } },
        messages: [{ role: "user", content }],
      });
      usage = {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        cacheReadTokens: response.usage.cache_read_input_tokens ?? 0,
        cacheWriteTokens: response.usage.cache_creation_input_tokens ?? 0,
      };
      if (response.stop_reason === "refusal") {
        return { ok: false, code: "refusal", message: "Le modèle a refusé d'analyser ces images.", usage, model: response.model };
      }
      if (response.stop_reason === "max_tokens") {
        return { ok: false, code: "invalid_output", message: "Réponse tronquée (trop d'objets).", usage, model: response.model };
      }
      const text = response.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
      try {
        return { ok: true, analysis: parseRoomAnalysis(text, input.images.length), usage, model: response.model };
      } catch {
        return { ok: false, code: "invalid_output", message: "Réponse du modèle illisible.", usage, model: response.model };
      }
    } catch (error) {
      if (error instanceof Anthropic.RateLimitError) {
        return { ok: false, code: "rate_limited", message: "Limite de débit du fournisseur atteinte.", usage, model: this.model };
      }
      if (error instanceof Anthropic.APIError) {
        return { ok: false, code: "provider_error", message: `Erreur du fournisseur (${error.status ?? "réseau"}).`, usage, model: this.model };
      }
      throw error;
    }
  }
}
