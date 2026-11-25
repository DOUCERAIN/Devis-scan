import Anthropic from "@anthropic-ai/sdk";

/**
 * Point d'entrée UNIQUE vers l'API Anthropic (serveur et scripts d'évaluation).
 *
 * - La clé est lue dans DEVIS_SCAN_ANTHROPIC_API_KEY, et uniquement là : le nom ANTHROPIC_API_KEY est réservé
 *   par l'environnement cloud de Claude Code (retiré des sessions), il n'est jamais lu par le projet.
 * - La clé est passée explicitement au SDK : celui-ci ne consulte alors ni ANTHROPIC_API_KEY ni ANTHROPIC_AUTH_TOKEN.
 * - L'adresse officielle est imposée (ANTHROPIC_BASE_URL ignorée) et toute requête vers un autre hôte est
 *   refusée avant envoi, pour que la clé ne parte jamais ailleurs.
 * - La valeur de la clé n'est jamais affichée ni journalisée : seuls sa présence et sa longueur peuvent l'être.
 */
export const ANTHROPIC_KEY_ENV = "DEVIS_SCAN_ANTHROPIC_API_KEY";
export const ANTHROPIC_OFFICIAL_BASE_URL = "https://api.anthropic.com";

const MIN_KEY_LENGTH = 20;

type Env = Record<string, string | undefined>;

/** Clé utilisable, ou null si absente / manifestement invalide. */
export function readAnthropicKey(env: Env = process.env): string | null {
  const key = env[ANTHROPIC_KEY_ENV]?.trim();
  return key && key.length >= MIN_KEY_LENGTH ? key : null;
}

/** Description sans la valeur : « présente (108 caractères) », « trop courte » ou « absente ». */
export function describeAnthropicKey(env: Env = process.env): string {
  const raw = env[ANTHROPIC_KEY_ENV]?.trim();
  if (!raw) return "absente";
  if (raw.length < MIN_KEY_LENGTH) return `trop courte (${raw.length} caractères) : non utilisée`;
  return `présente (${raw.length} caractères)`;
}

/** Vrai seulement pour une URL https sur l'hôte officiel (port par défaut). */
export function isOfficialAnthropicUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && u.host === "api.anthropic.com";
  } catch {
    return false;
  }
}

function requestUrl(input: Parameters<typeof fetch>[0]): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

/** fetch qui refuse tout hôte autre que l'API officielle (aucune donnée envoyée dans ce cas). */
export function officialOnlyFetch(base: typeof fetch = fetch): typeof fetch {
  return (input, init) => {
    const url = requestUrl(input);
    if (!isOfficialAnthropicUrl(url)) {
      return Promise.reject(new Error(`Requête refusée : seul ${ANTHROPIC_OFFICIAL_BASE_URL} est autorisé.`));
    }
    return base(input, init);
  };
}

export function createAnthropicClient(apiKey: string, options: { maxRetries: number; timeout: number }): Anthropic {
  return new Anthropic({
    apiKey,
    baseURL: ANTHROPIC_OFFICIAL_BASE_URL,
    fetch: officialOnlyFetch(),
    maxRetries: options.maxRetries,
    timeout: options.timeout,
  });
}
