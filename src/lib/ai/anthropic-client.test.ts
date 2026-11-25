import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ANTHROPIC_KEY_ENV,
  ANTHROPIC_OFFICIAL_BASE_URL,
  createAnthropicClient,
  describeAnthropicKey,
  isOfficialAnthropicUrl,
  officialOnlyFetch,
  readAnthropicKey,
} from "./anthropic-client.ts";

// Fausse clé de test (aucune valeur réelle), assez longue pour être acceptée.
const FAKE_KEY = "fausse-cle-de-test-0123456789";

test("la clé est lue uniquement dans DEVIS_SCAN_ANTHROPIC_API_KEY", () => {
  assert.equal(ANTHROPIC_KEY_ENV, "DEVIS_SCAN_ANTHROPIC_API_KEY");
  assert.equal(readAnthropicKey({ [ANTHROPIC_KEY_ENV]: FAKE_KEY }), FAKE_KEY);
  assert.equal(readAnthropicKey({ ANTHROPIC_API_KEY: FAKE_KEY }), null);
  assert.equal(readAnthropicKey({}), null);
  assert.equal(readAnthropicKey({ [ANTHROPIC_KEY_ENV]: "   " }), null);
  assert.equal(readAnthropicKey({ [ANTHROPIC_KEY_ENV]: "trop-courte" }), null);
});

test("la description ne contient jamais la valeur de la clé", () => {
  const text = describeAnthropicKey({ [ANTHROPIC_KEY_ENV]: FAKE_KEY });
  assert.equal(text, `présente (${FAKE_KEY.length} caractères)`);
  assert.ok(!text.includes(FAKE_KEY));
  assert.equal(describeAnthropicKey({ ANTHROPIC_API_KEY: FAKE_KEY }), "absente");
  assert.ok(!describeAnthropicKey({ [ANTHROPIC_KEY_ENV]: "abc" }).includes("abc"));
});

test("seule l'adresse https officielle est acceptée", () => {
  assert.equal(ANTHROPIC_OFFICIAL_BASE_URL, "https://api.anthropic.com");
  assert.ok(isOfficialAnthropicUrl("https://api.anthropic.com/v1/messages"));
  assert.ok(!isOfficialAnthropicUrl("http://api.anthropic.com/v1/messages"));
  assert.ok(!isOfficialAnthropicUrl("https://api.anthropic.com.exemple.fr/v1/messages"));
  assert.ok(!isOfficialAnthropicUrl("https://api.anthropic.com:8443/v1/messages"));
  assert.ok(!isOfficialAnthropicUrl("https://proxy.exemple.fr/v1/messages"));
  assert.ok(!isOfficialAnthropicUrl("pas une url"));
});

test("le garde-fou refuse un autre hôte sans rien envoyer", async () => {
  let called = false;
  const guarded = officialOnlyFetch(async () => {
    called = true;
    return new Response("{}");
  });
  await assert.rejects(guarded("https://proxy.exemple.fr/v1/messages"), /Requête refusée/);
  assert.equal(called, false);
});

test("le client ignore ANTHROPIC_BASE_URL, ANTHROPIC_API_KEY et ANTHROPIC_AUTH_TOKEN (aucun appel réel)", async () => {
  const saved = {
    base: process.env.ANTHROPIC_BASE_URL,
    key: process.env.ANTHROPIC_API_KEY,
    token: process.env.ANTHROPIC_AUTH_TOKEN,
    fetch: globalThis.fetch,
  };
  const seen: { url: string; apiKey: string | null; auth: string | null }[] = [];
  process.env.ANTHROPIC_BASE_URL = "https://proxy.exemple.fr";
  process.env.ANTHROPIC_API_KEY = "autre-cle-a-ne-pas-utiliser-0000";
  process.env.ANTHROPIC_AUTH_TOKEN = "autre-jeton-a-ne-pas-utiliser";
  globalThis.fetch = (async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const headers = new Headers(init?.headers);
    seen.push({ url, apiKey: headers.get("x-api-key"), auth: headers.get("authorization") });
    const body = {
      id: "msg_test", type: "message", role: "assistant", model: "claude-haiku-5-5",
      content: [{ type: "text", text: "OK" }], stop_reason: "end_turn", stop_sequence: null,
      usage: { input_tokens: 1, output_tokens: 1 },
    };
    return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
  }) as typeof fetch;
  try {
    const client = createAnthropicClient(FAKE_KEY, { maxRetries: 0, timeout: 5_000 });
    assert.equal(client.baseURL, ANTHROPIC_OFFICIAL_BASE_URL);
    await client.messages.create({ model: "claude-haiku-5-5", max_tokens: 5, messages: [{ role: "user", content: "test" }] });
    assert.equal(seen.length, 1);
    assert.equal(new URL(seen[0].url).origin, ANTHROPIC_OFFICIAL_BASE_URL);
    // SDK 1.7 : la clé passe dans « Authorization: Bearer » ; ce doit être la nôtre, jamais une autre variable.
    assert.equal(seen[0].auth, `Bearer ${FAKE_KEY}`);
    assert.equal(seen[0].apiKey, null);
  } finally {
    for (const [name, value] of [["ANTHROPIC_BASE_URL", saved.base], ["ANTHROPIC_API_KEY", saved.key], ["ANTHROPIC_AUTH_TOKEN", saved.token]] as const) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
    globalThis.fetch = saved.fetch;
  }
});
