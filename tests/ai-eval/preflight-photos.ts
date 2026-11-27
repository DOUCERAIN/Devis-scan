/**
 * Vérification HORS LIGNE de l'analyse réelle par photos, avant le premier appel payant.
 * AUCUNE requête ne quitte la machine : `fetch` est remplacé par une doublure qui enregistre la requête
 * préparée pour l'API Anthropic et renvoie une réponse factice au format de l'API. Aucune clé réelle
 * n'est utilisée (clé factice), aucun coût.
 *
 * Contrôle, avec le code de production (fournisseur, découpage en lots, lecture de la réponse,
 * correspondance au catalogue, calcul des volumes) :
 *  1. la requête envoyée à Claude Haiku 5.5 (modèle, photos JPEG, consignes, catalogue en cache, sortie
 *     structurée, effort, absence de paramètre refusé par Haiku 5.5) ;
 *  2. le découpage de N photos en lots (60 images au plus, 20 par appel) ;
 *  3. le traitement de la réponse : identifiants du catalogue, volumes lus dans le catalogue (jamais fournis
 *     par l'IA), objet inconnu sans volume inventé, meuble vu dans deux lots signalé « à vérifier » ;
 *  4. le coût estimé d'une analyse selon le nombre de photos.
 *
 *   node --conditions=react-server tests/ai-eval/preflight-photos.ts [nombre de photos, défaut 25]
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { AnthropicVisionProvider } from "../../src/lib/ai/providers/anthropic.ts";
import { catalogPrompt } from "../../src/lib/ai/prompt.ts";
import { buildItems, type CatalogRef } from "../../src/lib/ai/postprocess.ts";
import { estimateCostUsd, formatCostUsd } from "../../src/lib/ai/cost.ts";
import { mergeBatchDetections, planHomeBatches, MAX_HOME_IMAGES, HOME_BATCH_SIZE } from "../../src/lib/analysis/batches.ts";
import type { DetectedObject } from "../../src/lib/ai/output.ts";

const here = path.dirname(fileURLToPath(import.meta.url));
const MODEL = "claude-haiku-5-5";
const FAKE_KEY = "cle-factice-".padEnd(48, "x");
const photoCount = Math.max(1, Math.min(80, Number(process.argv[2] ?? 25) || 25));

// Catalogue : même source que la base (data/catalog/catalog.json → migration furniture_catalog_data).
type Raw = { id: string; name: string; synonyms: string[]; heavy: boolean; handling: string; moving_volume_m3: { min: number; avg: number; max: number } | null; geometric_volume_m3: { avg: number } | null };
const rawCatalog = JSON.parse(readFileSync(path.join(here, "../../data/catalog/catalog.json"), "utf8")).items as Raw[];
const catalogRefs: CatalogRef[] = rawCatalog.map((r) => ({
  id: r.id, name: r.name, synonyms: r.synonyms ?? [], heavy: r.heavy, handling: r.handling as CatalogRef["handling"],
  moving_volume_min: r.moving_volume_m3?.min ?? null, moving_volume_avg: r.moving_volume_m3?.avg ?? null, moving_volume_max: r.moving_volume_m3?.max ?? null,
  geometric_volume_avg: r.geometric_volume_m3?.avg ?? null,
}));
const catalog = new Map(catalogRefs.map((r) => [r.id, r]));
const catalogText = catalogPrompt(catalogRefs);

// Photos réelles sous licence libre (tests/ai-eval/images), préparées comme dans le navigateur :
// grand côté ramené à 1 600 px, JPEG (src/lib/video/photo.ts).
const work = mkdtempSync(path.join(tmpdir(), "preflight-"));
const sources = readdirSync(path.join(here, "images")).filter((f) => f.endsWith(".jpg"));
const prepared = sources.map((f) => {
  const out = path.join(work, f);
  execFileSync("ffmpeg", ["-loglevel", "error", "-y", "-i", path.join(here, "images", f), "-vf", "scale='min(1600,iw)':'min(1600,ih)':force_original_aspect_ratio=decrease", "-q:v", "3", out]);
  const [w, h] = execFileSync("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "csv=p=0", out]).toString().trim().split(",").map(Number);
  return { file: f, base64: readFileSync(out).toString("base64"), width: w, height: h };
});

// N photos (les 3 photos libres réutilisées en boucle), dans l'ordre d'envoi.
const frames = Array.from({ length: photoCount }, (_, i) => ({
  id: `photo-${i}`, storage_path: `x/${i}.jpg`, captured_at_ms: 0, videoCreatedAt: `2026-12-01T10:${String(i).padStart(2, "0")}`,
  photo: prepared[i % prepared.length],
}));
const batches = planHomeBatches(frames);

// Doublure de fetch : enregistre la requête, renvoie une réponse au format de l'API (jamais d'accès réseau).
const sent: { url: string; headers: Headers; body: Record<string, unknown> }[] = [];
const fakeResponses: DetectedObject[][] = [
  [
    { label: "Canapé trois places gris", catalog_id: "canape-3-places", quantity: 1, confidence: 0.92, visibility: "visible", image_indexes: [0], dimensions_cm: null, is_fragile: false, needs_disassembly: false, may_be_same_as: "", location_in_room: "salon, contre le mur", distinctive_features: "gris", identity_doubt: null, notes: "" },
    { label: "Lit double", catalog_id: "lit-double", quantity: 1, confidence: 0.9, visibility: "visible", image_indexes: [1], dimensions_cm: null, is_fragile: false, needs_disassembly: true, may_be_same_as: "", location_in_room: "chambre", distinctive_features: "", identity_doubt: null, notes: "" },
    { label: "Statue en pierre", catalog_id: "autre", quantity: 1, confidence: 0.7, visibility: "visible", image_indexes: [2], dimensions_cm: null, is_fragile: true, needs_disassembly: false, may_be_same_as: "", location_in_room: "entrée", distinctive_features: "", identity_doubt: null, notes: "" },
  ],
  [
    { label: "Canapé trois places gris", catalog_id: "canape-3-places", quantity: 1, confidence: 0.9, visibility: "visible", image_indexes: [0], dimensions_cm: null, is_fragile: false, needs_disassembly: false, may_be_same_as: "", location_in_room: "salon", distinctive_features: "gris", identity_doubt: null, notes: "" },
    { label: "Lits simples", catalog_id: "lit-simple", quantity: 2, confidence: 0.88, visibility: "visible", image_indexes: [1], dimensions_cm: null, is_fragile: false, needs_disassembly: true, may_be_same_as: "", location_in_room: "chambre d'enfants", distinctive_features: "", identity_doubt: null, notes: "" },
  ],
];
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const request = new Request(input, init);
  const body = JSON.parse(await request.text());
  sent.push({ url: request.url, headers: request.headers, body });
  const objects = fakeResponses[(sent.length - 1) % fakeResponses.length];
  const payload = { id: `msg_${sent.length}`, type: "message", role: "assistant", model: MODEL, stop_reason: "end_turn", stop_sequence: null,
    content: [{ type: "thinking", thinking: "", signature: "x" }, { type: "text", text: JSON.stringify({ objects, room_notes: "" }) }],
    usage: { input_tokens: 1000, output_tokens: 500, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 } };
  return new Response(JSON.stringify(payload), { status: 200, headers: { "content-type": "application/json", "request-id": "req_test" } });
}) as typeof fetch;

const provider = new AnthropicVisionProvider(FAKE_KEY, MODEL, "medium");
const results = [];
for (const [part, batch] of batches.entries()) {
  const r = await provider.analyzeRoom({
    roomName: "Mon logement", roomDescription: null, catalogText, wholeHome: { part: part + 1, parts: batches.length },
    images: batch.map((f) => ({ mediaType: "image/jpeg" as const, base64: f.photo.base64 })),
  });
  assert.equal(r.ok, true, JSON.stringify(r));
  if (r.ok) results.push({ objects: r.analysis.objects, frameIds: batch.map((f) => f.id) });
}

// 1. Requêtes préparées
console.log(`\n1. Requêtes préparées pour ${photoCount} photo(s) : ${sent.length} appel(s) (60 images au plus, ${HOME_BATCH_SIZE} par appel)`);
sent.forEach((s, i) => {
  const b = s.body as { model: string; messages: { content: { type: string; source?: { media_type: string } }[] }[]; system: { cache_control?: unknown; text: string }[]; output_config: { effort: string; format: { type: string } }; max_tokens: number };
  assert.equal(s.url, "https://api.anthropic.com/v1/messages", "adresse officielle uniquement");
  // Le SDK 1.x transmet la clé d'API en « Authorization: Bearer » : c'est bien la clé fournie par le projet
  // (ici factice) qui part, jamais un identifiant lu dans l'environnement.
  assert.equal(s.headers.get("authorization"), `Bearer ${FAKE_KEY}`, "clé du projet transmise (valeur jamais affichée)");
  assert.equal(b.model, MODEL);
  for (const forbidden of ["temperature", "top_p", "top_k", "fallbacks", "thinking"]) assert.ok(!(forbidden in b), `${forbidden} absent (refusé ou inutile sur Haiku 5.5)`);
  const imgs = b.messages[0].content.filter((c) => c.type === "image");
  assert.equal(imgs.length, batches[i].length);
  assert.ok(imgs.every((c) => c.source?.media_type === "image/jpeg"));
  assert.equal(b.output_config.effort, "medium");
  assert.equal(b.output_config.format.type, "json_schema");
  assert.ok(b.system[1].cache_control && b.system[1].text.includes("canape-3-places"), "catalogue en cache");
  console.log(`   appel ${i + 1} : ${imgs.length} photo(s) JPEG, modèle ${b.model}, effort ${b.output_config.effort}, sortie structurée, catalogue de ${catalogRefs.length} références en cache, max_tokens ${b.max_tokens}`);
});
console.log(`   photos préparées comme dans le navigateur : ${prepared.map((p) => `${p.width}×${p.height}`).join(", ")}`);
if (photoCount > MAX_HOME_IMAGES) console.log(`   ⚠ ${photoCount} photos : seules ${MAX_HOME_IMAGES}, réparties uniformément, sont analysées.`);

// 2-3. Traitement de la réponse
const merged = mergeBatchDetections(results);
const items = buildItems([{ roomId: "logement", ...merged }], catalog);
console.log("\n2. Inventaire obtenu à partir de la réponse (volumes lus dans le catalogue, jamais fournis par l'IA)");
for (const it of items) console.log(`   ${it.name} × ${it.quantity} : ${it.catalogKey ?? "hors catalogue"}, ${it.unitVolumeM3} m³/u (${it.volumeSource})${it.possibleDuplicate ? " — doublon possible, à vérifier" : ""}`);
const sofa = items.filter((i) => i.catalogKey === "canape-3-places");
if (batches.length > 1) {
  assert.equal(sofa.length, 2, "rien n'est retiré automatiquement");
  assert.equal(sofa.filter((s) => s.possibleDuplicate).length, 1, "canapé vu dans deux lots : signalé « à vérifier »");
}
assert.ok(sofa.every((s) => s.unitVolumeM3 === catalog.get("canape-3-places")!.moving_volume_avg));
const statue = items.find((i) => i.name.startsWith("Statue"));
assert.equal(statue?.unitVolumeM3, 0, "objet hors catalogue sans dimensions : aucun volume inventé");

// 4. Coût estimé (tarifs de src/lib/ai/cost.ts ; jetons d'image ≈ largeur × hauteur / 750)
const imageTokens = Math.ceil((1600 * 1200) / 750);
const promptTokens = 1500;
const catalogTokens = 5755; // mesuré lors du test réel du 25/11/2026
console.log(`\n3. Coût estimé d'une analyse (${MODEL}, photos 1 600 × 1 200 ≈ ${imageTokens} jetons chacune)`);
for (const n of [10, 20, 30, 45, 60, 80]) {
  const plan = planHomeBatches(Array.from({ length: n }, (_, i) => ({ id: `${i}`, storage_path: "", captured_at_ms: 0, videoCreatedAt: `${i}`.padStart(3, "0") })));
  let typical = 0;
  let high = 0;
  plan.forEach((b, i) => {
    const input = b.length * imageTokens + promptTokens;
    const cache = i === 0 ? { cacheWriteTokens: catalogTokens, cacheReadTokens: 0 } : { cacheWriteTokens: 0, cacheReadTokens: catalogTokens };
    typical += estimateCostUsd(MODEL, { inputTokens: input, outputTokens: 4000, ...cache }) ?? 0;
    high += estimateCostUsd(MODEL, { inputTokens: input, outputTokens: 16000, ...cache }) ?? 0;
  });
  console.log(`   ${String(n).padStart(2)} photos → ${plan.length} appel(s) : environ ${formatCostUsd(typical)} (plafond de sortie atteint à chaque appel : ${formatCostUsd(high)})${n > MAX_HOME_IMAGES ? ` — seules ${MAX_HOME_IMAGES} photos analysées` : ""}`);
}
console.log("\nVérification hors ligne réussie : aucune requête n'a quitté la machine, aucun coût.");
