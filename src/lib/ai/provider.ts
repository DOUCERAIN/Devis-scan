import type { RoomAnalysis } from "./output.ts";
import type { TokenUsage } from "./cost.ts";

export type RoomImage = { mediaType: "image/jpeg" | "image/png" | "image/webp"; base64: string };

export type RoomInput = {
  roomName: string;
  roomDescription: string | null;
  images: RoomImage[];
  /** Texte du catalogue (stable, mis en cache). */
  catalogText: string;
  /**
   * Médias de l'ensemble du logement (parcours v3 : vidéos et photos sans pièce imposée), éventuellement
   * répartis en plusieurs lots d'images analysés l'un après l'autre.
   */
  wholeHome?: { part: number; parts: number };
};

export type RoomResult =
  | { ok: true; analysis: RoomAnalysis; usage: TokenUsage; model: string }
  | { ok: false; code: "refusal" | "invalid_output" | "provider_error" | "rate_limited"; message: string; usage: TokenUsage; model: string };

/**
 * Fournisseur d'analyse visuelle interchangeable.
 * `simulated` est vrai uniquement pour le simulateur de test : ses résultats ne sont jamais
 * présentés comme une analyse réelle (analysis_runs.simulated, bandeau dans l'interface).
 */
export interface VisionProvider {
  readonly id: "anthropic" | "simulation";
  readonly model: string;
  readonly simulated: boolean;
  analyzeRoom(input: RoomInput): Promise<RoomResult>;
}
