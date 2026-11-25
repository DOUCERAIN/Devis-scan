/**
 * Appel de test UNIQUE et minimal à l'API Anthropic (aucune image, réponse de quelques mots).
 * Vérifie la clé et le réseau, affiche le modèle, les jetons facturés et le coût. N'affiche jamais la clé.
 *
 *   node --conditions=react-server tests/ai-eval/ping.ts
 */
import Anthropic from "@anthropic-ai/sdk";
import { ANTHROPIC_KEY_ENV, ANTHROPIC_OFFICIAL_BASE_URL, createAnthropicClient, describeAnthropicKey, readAnthropicKey } from "../../src/lib/ai/anthropic-client.ts";
import { estimateCostUsd, formatCostUsd } from "../../src/lib/ai/cost.ts";

const key = readAnthropicKey();
console.log(`${ANTHROPIC_KEY_ENV} : ${describeAnthropicKey()}`);
console.log(`AI_PROVIDER : ${process.env.AI_PROVIDER ?? "absente"}`);
console.log(`Adresse de l'API (imposée) : ${ANTHROPIC_OFFICIAL_BASE_URL}`);
if (!key) process.exit(3);
if (process.argv.includes("--check")) {
  console.log("Vérification seule (--check) : aucun appel envoyé.");
  process.exit(0);
}

const model = "claude-haiku-5-5"; // modèle le moins cher, pour un simple test de connexion
const client = createAnthropicClient(key, { maxRetries: 0, timeout: 60_000 });
try {
  const started = Date.now();
  const r = await client.messages.create({
    model,
    max_tokens: 200,
    output_config: { effort: "low" },
    messages: [{ role: "user", content: "Test de connexion. Réponds uniquement par : OK" }],
  });
  const text = r.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("").trim();
  const usage = {
    inputTokens: r.usage.input_tokens,
    outputTokens: r.usage.output_tokens,
    cacheReadTokens: r.usage.cache_read_input_tokens ?? 0,
    cacheWriteTokens: r.usage.cache_creation_input_tokens ?? 0,
  };
  console.log(`Résultat : réponse reçue en ${Date.now() - started} ms, modèle ${r.model}, fin : ${r.stop_reason}, texte : « ${text} »`);
  console.log(`Jetons facturés : ${usage.inputTokens} en entrée, ${usage.outputTokens} en sortie`);
  console.log(`Coût estimé (tarif public) : ${formatCostUsd(estimateCostUsd(model, usage))}`);
} catch (error) {
  if (error instanceof Anthropic.APIError) {
    // Message d'erreur de l'API uniquement (il ne contient pas la clé).
    console.error(`Échec : statut ${error.status ?? "réseau"} — ${error.message}`);
  } else {
    console.error("Échec : erreur réseau ou inattendue", error instanceof Error ? error.name : "");
  }
  process.exit(1);
}
