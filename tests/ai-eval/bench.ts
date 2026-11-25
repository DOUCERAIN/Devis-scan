/**
 * Banc de comparaison RÉEL de Claude Haiku 5.5, Sonnet 5.5 et Opus 5.5 sur les mêmes images.
 * Protocole complet : tests/ai-eval/PROTOCOLE.md. Jeu de données : tests/ai-eval/dataset/<cas>/case.json.
 *
 *   node --conditions=react-server tests/ai-eval/bench.ts              # vérifie le jeu de données et le budget, AUCUN appel
 *   node --conditions=react-server tests/ai-eval/bench.ts --confirm    # appels réels (facturés au titulaire de la clé)
 *   node --conditions=react-server tests/ai-eval/bench.ts --rescore tests/ai-eval/results/<passage>/resultats.json
 *                                                                      # renote un passage avec les références actuelles, AUCUN appel
 * Options : --models haiku,sonnet,opus  --cases id1,id2  --effort medium  --max-output-tokens 7000  --repeat 1
 *           --max-usd-per-model 0.75  --max-usd-campaign 5 (jamais au-delà de 5)  --rooms-per-request 6
 *
 * Sécurité : clé lue uniquement dans DEVIS_SCAN_ANTHROPIC_API_KEY, envoyée uniquement à https://api.anthropic.com
 * (src/lib/ai/anthropic-client.ts) ; aucune nouvelle tentative automatique ; pas de repli vers un autre modèle ;
 * coût maximal réservé dans le registre AVANT chaque appel ; arrêt immédiat si un plafond peut être dépassé
 * ou si l'API renvoie une erreur.
 */
import fs from "node:fs";
import { randomBytes } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { AnthropicVisionProvider } from "../../src/lib/ai/providers/anthropic.ts";
import { ANTHROPIC_KEY_ENV, ANTHROPIC_OFFICIAL_BASE_URL, describeAnthropicKey, readAnthropicKey } from "../../src/lib/ai/anthropic-client.ts";
import { ANALYSIS_INSTRUCTIONS, catalogPrompt, roomPrompt } from "../../src/lib/ai/prompt.ts";
import { ROOM_ANALYSIS_JSON_SCHEMA, roomAnalysisSchema, type RoomAnalysis } from "../../src/lib/ai/output.ts";
import { buildItems, type CatalogRef, type ItemDraft } from "../../src/lib/ai/postprocess.ts";
import { estimateCostUsd, formatCostUsd, MODEL_PRICES_USD, PRICES_CHECKED_AT, type TokenUsage } from "../../src/lib/ai/cost.ts";
import type { RoomImage } from "../../src/lib/ai/provider.ts";
import { modelLabel, resolveModels } from "../../src/lib/ai/benchmark/models.ts";
import { worstCaseCallCostUsd, type CallShape } from "../../src/lib/ai/benchmark/tokens.ts";
import { BudgetGuard, CAMPAIGN_HARD_CAP_USD, checkPlan, DEFAULT_PER_MODEL_CAP_USD, newLedger, type Ledger, type PlannedCall } from "../../src/lib/ai/benchmark/budget.ts";
import { caseSchema, coverage, readImageInfo, validateCase, type BenchmarkCase, type FrameInfo } from "../../src/lib/ai/benchmark/dataset.ts";
import { scoreCase, summarizeModel, type CatalogInfo, type CaseScore } from "../../src/lib/ai/benchmark/score.ts";
import { renderDetailsCsv, renderMarkdown, renderSummaryCsv, type ReportCall } from "../../src/lib/ai/benchmark/report.ts";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../..");
const rel = (p: string) => path.relative(root, p);

// ---------- Options ----------
const argv = process.argv.slice(2);
const KNOWN = new Set(["models", "cases", "effort", "max-output-tokens", "repeat", "max-usd-per-model", "max-usd-campaign", "rooms-per-request", "rescore", "dataset", "confirm"]);
for (const a of argv) if (a.startsWith("--") && !KNOWN.has(a.slice(2))) fail(`Option inconnue : ${a}`);
function arg(name: string): string | undefined {
  const i = argv.indexOf(`--${name}`);
  if (i < 0) return undefined;
  const v = argv[i + 1];
  if (v === undefined || v.startsWith("--")) fail(`Valeur manquante pour --${name}`);
  return v;
}
function num(name: string, fallback: number, min: number, max: number): number {
  const raw = arg(name);
  const v = raw === undefined ? fallback : Number(raw.replace(",", "."));
  if (!Number.isFinite(v) || v < min || v > max) fail(`--${name} doit être compris entre ${min} et ${max}.`);
  return v;
}
function fail(message: string, code = 2): never {
  console.error(`✗ ${message}`);
  process.exit(code);
}

const confirm = argv.includes("--confirm");
const rescorePath = arg("rescore");
if (confirm && rescorePath) fail("--rescore ne fait aucun appel : ne pas le combiner avec --confirm.");
const effortArg = arg("effort") ?? "medium";
if (!["low", "medium", "high"].includes(effortArg)) fail("--effort : low, medium ou high.");
const effort = effortArg as "low" | "medium" | "high";
const maxOutputTokens = Math.round(num("max-output-tokens", 7000, 1000, 16000));
const repeat = Math.round(num("repeat", 1, 1, 5));
const roomsPerRequest = Math.round(num("rooms-per-request", 6, 1, 30));
const campaignCapUsd = num("max-usd-campaign", CAMPAIGN_HARD_CAP_USD, 0.01, CAMPAIGN_HARD_CAP_USD);
const perModelCapUsd = num("max-usd-per-model", DEFAULT_PER_MODEL_CAP_USD, 0.01, campaignCapUsd);
let models: string[];
try {
  models = resolveModels(arg("models") ?? "haiku,sonnet,opus");
} catch (e) {
  fail((e as Error).message);
}
const datasetDir = path.resolve(root, arg("dataset") ?? rel(path.join(here, "dataset")));
const resultsDir = path.join(here, "results");
const ledgerPath = path.join(resultsDir, "ledger.json");

// ---------- Catalogue (même source que la base : data/catalog/catalog.json) ----------
type CatalogJson = { items: { id: string; name: string; subcategory: string; synonyms: string[]; heavy: boolean; handling: string; moving_volume_m3: { min: number; avg: number; max: number } | null; geometric_volume_m3: { avg: number } | null }[] };
const catalogJson: CatalogJson = JSON.parse(fs.readFileSync(path.join(root, "data/catalog/catalog.json"), "utf8"));
const catalog: CatalogRef[] = catalogJson.items.map((i) => ({
  id: i.id, name: i.name, synonyms: i.synonyms, heavy: i.heavy, handling: i.handling,
  moving_volume_min: i.moving_volume_m3?.min ?? null, moving_volume_avg: i.moving_volume_m3?.avg ?? null,
  moving_volume_max: i.moving_volume_m3?.max ?? null, geometric_volume_avg: i.geometric_volume_m3?.avg ?? null,
}));
const catalogMap = new Map(catalog.map((c) => [c.id, c]));
const catalogInfo = new Map<string, CatalogInfo>(catalogJson.items.map((i) => [i.id, { subcategory: i.subcategory, movingVolumeAvg: i.moving_volume_m3?.avg ?? null }]));
const catalogText = catalogPrompt(catalog);

// ---------- Jeu de données ----------
type LoadedCase = { case: BenchmarkCase; dir: string; frames: FrameInfo[] };
function loadDataset(): LoadedCase[] {
  if (!fs.existsSync(datasetDir)) fail(`Dossier du jeu de données introuvable : ${rel(datasetDir)}`);
  const wanted = arg("cases")?.split(",").map((s) => s.trim()).filter(Boolean);
  const ids = fs.readdirSync(datasetDir).filter((d) => fs.existsSync(path.join(datasetDir, d, "case.json"))).sort();
  if (wanted) for (const w of wanted) if (!ids.includes(w)) fail(`Cas inconnu : ${w}`);
  const problems: string[] = [];
  const loaded: LoadedCase[] = [];
  for (const id of wanted ?? ids) {
    const dir = path.join(datasetDir, id);
    const parsed = caseSchema.safeParse(JSON.parse(fs.readFileSync(path.join(dir, "case.json"), "utf8")));
    if (!parsed.success) {
      problems.push(`${id} : case.json invalide — ${parsed.error.issues.map((i) => `${i.path.join(".")} : ${i.message}`).join(" ; ")}`);
      continue;
    }
    const c = parsed.data;
    if (c.id !== id) problems.push(`${id} : l'identifiant du fichier (${c.id}) doit être le nom du dossier`);
    const frames = new Map<string, FrameInfo | null>();
    for (const f of c.frames) {
      const file = path.join(dir, "frames", f.file);
      frames.set(f.file, fs.existsSync(file) ? readImageInfo(f.file, fs.readFileSync(file)) : null);
    }
    for (const p of validateCase(c, { catalogIds: new Set(catalogMap.keys()), frames })) problems.push(`${id} : ${p}`);
    loaded.push({ case: c, dir, frames: c.frames.map((f) => frames.get(f.file)).filter((f): f is FrameInfo => !!f) });
  }
  if (problems.length) fail(`Jeu de données à corriger :\n  - ${problems.join("\n  - ")}`);
  if (loaded.length === 0) fail("Aucun cas dans le jeu de données.");
  return loaded;
}

const fixedTextChars = ANALYSIS_INSTRUCTIONS.length + catalogText.length + JSON.stringify(ROOM_ANALYSIS_JSON_SCHEMA).length;
const shapeOf = (lc: LoadedCase): CallShape => ({
  images: lc.frames.map((f) => ({ width: f.width, height: f.height })),
  textChars: fixedTextChars + roomPrompt({ name: lc.case.room_label, description: lc.case.room_description }, lc.frames.length).length,
  maxOutputTokens,
});

// ---------- Registre de la campagne ----------
function loadLedger(): Ledger {
  if (!fs.existsSync(ledgerPath)) return newLedger("benchmark-ia-devis-scan");
  return JSON.parse(fs.readFileSync(ledgerPath, "utf8")) as Ledger;
}
function writeJsonAtomic(file: string, data: unknown) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2) + "\n");
  fs.renameSync(tmp, file);
}

// ---------- Résultats ----------
type CallRecord = ReportCall & { analysis: RoomAnalysis | null; items: ItemDraft[] | null; message: string | null };
type RunFile = {
  schema_version: 1;
  run_id: string;
  started_at: string;
  finished_at: string | null;
  status: "complet" | "interrompu";
  stop_reason: string | null;
  config: { models: string[]; effort: string; max_output_tokens: number; repeat: number; per_model_cap_usd: number; campaign_cap_usd: number; rooms_per_request: number; max_retries: 0; server_fallback: false; api_base_url: string };
  prices: typeof MODEL_PRICES_USD;
  prices_checked_at: string;
  cases: string[];
  calls: CallRecord[];
};

function writeReports(run: RunFile, outDir: string, cases: LoadedCase[], ledger: Ledger, suffix = "") {
  const byId = new Map(cases.map((c) => [c.case.id, c]));
  const caseScores: { model: string; pass: number; score: CaseScore }[] = [];
  for (const call of run.calls) {
    const lc = byId.get(call.caseId);
    if (!lc) continue; // cas retiré du jeu de données depuis le passage
    // Inventaire recalculé depuis la réponse BRUTE du modèle avec le post-traitement actuel :
    // une renotation reflète les corrections du post-traitement sans nouvel appel.
    const items = call.ok && call.analysis
      ? buildItems([{ roomId: call.caseId, objects: roomAnalysisSchema.parse(call.analysis).objects, frameIds: lc.frames.map((f) => f.file) }], catalogMap)
      : null;
    caseScores.push({ model: call.model, pass: call.pass, score: scoreCase(call.caseId, items, lc.case.reference.items, catalogInfo) });
  }
  const summaries = run.config.models
    .filter((m) => run.calls.some((c) => c.model === m))
    .map((m) => summarizeModel(m, caseScores.filter((s) => s.model === m).map((s) => s.score), run.calls.filter((c) => c.model === m)));
  const usedCases = cases.filter((c) => run.calls.some((x) => x.caseId === c.case.id));
  const guard = new BudgetGuard({ ledger, runId: run.run_id, perModelCapUsd: run.config.per_model_cap_usd, campaignCapUsd: run.config.campaign_cap_usd });
  const runCounted = ledger.entries.filter((e) => e.run_id === run.run_id).reduce((s, e) => s + (e.status === "settled" && e.cost_usd !== null ? e.cost_usd : e.reserved_usd), 0);
  const report = {
    title: "Comparaison réelle des modèles d'analyse — Devis Scan",
    generatedAt: new Date(),
    runId: run.run_id,
    status: run.status,
    stopReason: run.stop_reason,
    config: { effort: run.config.effort, maxOutputTokens: run.config.max_output_tokens, repeat: run.config.repeat, perModelCapUsd: run.config.per_model_cap_usd, campaignCapUsd: run.config.campaign_cap_usd, roomsPerRequest: run.config.rooms_per_request, pricesCheckedAt: run.prices_checked_at },
    models: run.config.models,
    cases: usedCases.map((c) => ({ id: c.case.id, roomLabel: c.case.room_label, roomType: c.case.room_type, situations: c.case.situations, frames: c.frames.length, referenceStatus: c.case.reference.status })),
    coverage: coverage(usedCases.map((c) => c.case)),
    summaries,
    caseScores,
    calls: run.calls,
    budget: { runCountedUsd: runCounted, campaignCountedUsd: guard.campaignSpentUsd(), campaignCapUsd: guard.campaignCapUsd },
  };
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, `rapport${suffix}.md`), renderMarkdown(report));
  fs.writeFileSync(path.join(outDir, `comparatif${suffix}.csv`), renderSummaryCsv(summaries, run.config.rooms_per_request));
  fs.writeFileSync(path.join(outDir, `details${suffix}.csv`), renderDetailsCsv(caseScores, run.calls));
  console.log(`\nRapport : ${rel(path.join(outDir, `rapport${suffix}.md`))}`);
  console.log(`Tableaux (tableur) : ${rel(path.join(outDir, `comparatif${suffix}.csv`))}, ${rel(path.join(outDir, `details${suffix}.csv`))}`);
}

// ---------- Renotation sans appel ----------
if (rescorePath) {
  const file = path.resolve(root, rescorePath);
  if (!fs.existsSync(file)) fail(`Fichier introuvable : ${rescorePath}`);
  const run = JSON.parse(fs.readFileSync(file, "utf8")) as RunFile;
  const cases = loadDataset();
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  console.log(`Renotation du passage ${run.run_id} avec les références actuelles (aucun appel à l'API).`);
  writeReports(run, path.dirname(file), cases, loadLedger(), `-renote-${stamp}`);
  process.exit(0);
}

// ---------- Plan et budget ----------
const cases = loadDataset();
// Identifiant unique (millisecondes + suffixe aléatoire) : deux passages ne partagent jamais leur plafond par modèle.
const runId = `${new Date().toISOString().replace(/[:.]/g, "-").slice(0, 23)}-${randomBytes(2).toString("hex")}`;
const ledger = loadLedger();
const guard = new BudgetGuard({ ledger, runId, perModelCapUsd, campaignCapUsd });
type Step = PlannedCall & { pass: number; lc: LoadedCase };
const plan: Step[] = [];
for (let pass = 1; pass <= repeat; pass++) {
  cases.forEach((lc, i) => {
    // Ordre des modèles décalé d'un cas à l'autre (même nombre de « premières places » pour chacun) ;
    // passage cas par cas : un arrêt en cours laisse des résultats comparables.
    const order = models.map((_, k) => models[(k + i) % models.length]);
    for (const model of order) plan.push({ model, caseId: lc.case.id, worstCaseUsd: worstCaseCallCostUsd(model, shapeOf(lc)), pass, lc });
  });
}
const verdict = checkPlan(guard, plan);
const totalFrames = cases.reduce((s, c) => s + c.frames.length, 0);

console.log("Banc de comparaison IA — Devis Scan");
console.log(`Jeu de données : ${cases.length} pièce(s), ${totalFrames} image(s) (${rel(datasetDir)}).`);
const cov = coverage(cases.map((c) => c.case));
for (const l of cov.lines.filter((x) => !x.ok)) console.log(`  ⚠ couverture : ${l.label} ${l.have} / ${l.target}`);
if (!cov.representative) console.log("  ⚠ jeu de données non représentatif : résultats indicatifs (voir tests/ai-eval/dataset/README.md).");
console.log(`Modèles : ${models.map((m) => `${modelLabel(m)} (${m})`).join(", ")}. Effort ${effort}, sortie ≤ ${maxOutputTokens.toLocaleString("fr-FR")} jetons, ${repeat} passage(s), ${plan.length} appel(s).`);
console.log("Coût MAXIMAL (pire cas : toute l'entrée au tarif d'écriture en cache, sortie au plafond) :");
for (const m of verdict.perModel) console.log(`  ${modelLabel(m.model).padEnd(18)} ${String(m.calls).padStart(3)} appel(s)  ≤ ${formatCostUsd(m.worstCaseUsd).padEnd(12)} plafond ${formatCostUsd(m.capUsd)}  ${m.ok ? "ok" : "DÉPASSE"}`);
console.log(`  Total ≤ ${formatCostUsd(verdict.totalWorstCaseUsd)} · campagne déjà comptée ${formatCostUsd(verdict.campaignSpentUsd)} / plafond absolu ${formatCostUsd(verdict.campaignCapUsd)}`);
if (!verdict.ok) fail(`Budget insuffisant, aucun appel lancé :\n  - ${verdict.reasons.join("\n  - ")}\n  Réduire --cases, --models, --repeat ou --max-output-tokens.`);

if (!confirm) {
  console.log(`\nVérification terminée : AUCUN appel n'a été envoyé. ${ANTHROPIC_KEY_ENV} : ${describeAnthropicKey()}.`);
  console.log("Pour lancer les appels réels (après accord explicite) : ajouter --confirm.");
  process.exit(0);
}

// ---------- Appels réels ----------
const apiKey = readAnthropicKey();
console.log(`\n${ANTHROPIC_KEY_ENV} : ${describeAnthropicKey()} · adresse imposée : ${ANTHROPIC_OFFICIAL_BASE_URL}`);
if (!apiKey) fail(`${ANTHROPIC_KEY_ENV} absente ou invalide : aucun appel possible (voir docs/connexion-cle-anthropic.md).`, 3);

const outDir = path.join(resultsDir, runId);
const run: RunFile = {
  schema_version: 1,
  run_id: runId,
  started_at: new Date().toISOString(),
  finished_at: null,
  status: "interrompu",
  stop_reason: "passage en cours ou arrêté brutalement",
  config: { models, effort, max_output_tokens: maxOutputTokens, repeat, per_model_cap_usd: guard.perModelCapUsd, campaign_cap_usd: guard.campaignCapUsd, rooms_per_request: roomsPerRequest, max_retries: 0, server_fallback: false, api_base_url: ANTHROPIC_OFFICIAL_BASE_URL },
  prices: MODEL_PRICES_USD,
  prices_checked_at: PRICES_CHECKED_AT,
  cases: cases.map((c) => c.case.id),
  calls: [],
};
const providers = new Map(models.map((m) => [m, new AnthropicVisionProvider(apiKey, m, effort, { maxRetries: 0, maxTokens: maxOutputTokens, serverFallback: false, timeoutMs: 300_000 })]));
const usageKnown = (u: TokenUsage) => u.inputTokens + u.outputTokens + u.cacheReadTokens + u.cacheWriteTokens > 0;
let stopReason: string | null = null;

for (const step of plan) {
  // 1. Réservation du coût maximal (refusée si un plafond peut être dépassé : arrêt immédiat).
  const check = guard.check(step.model, step.worstCaseUsd);
  if (!check.ok) {
    stopReason = `budget : ${check.reason}`;
    break;
  }
  const entry = guard.reserve(step.model, step.caseId, step.worstCaseUsd);
  writeJsonAtomic(ledgerPath, ledger);

  // 2. Un seul appel, sans nouvelle tentative.
  const images: RoomImage[] = step.lc.frames.map((f) => ({ mediaType: f.mediaType, base64: fs.readFileSync(path.join(step.lc.dir, "frames", f.file)).toString("base64") }));
  const started = Date.now();
  let record: CallRecord;
  try {
    const result = await providers.get(step.model)!.analyzeRoom({ roomName: step.lc.case.room_label, roomDescription: step.lc.case.room_description, images, catalogText });
    const latencyMs = Date.now() - started;
    const known = usageKnown(result.usage);
    const costUsd = known ? estimateCostUsd(step.model, result.usage) : null;
    if (known && costUsd !== null) guard.settle(entry, result.usage, costUsd);
    else guard.markUnknown(entry, result.ok ? "jetons non renvoyés" : `${result.code} sans jetons renvoyés`);
    record = {
      caseId: step.caseId, model: step.model, pass: step.pass, servedModel: result.model, ok: result.ok, code: result.ok ? null : result.code,
      message: result.ok ? null : result.message, latencyMs, usage: known ? result.usage : null, costUsd,
      analysis: result.ok ? result.analysis : null,
      items: result.ok ? buildItems([{ roomId: step.caseId, objects: result.analysis.objects, frameIds: step.lc.frames.map((f) => f.file) }], catalogMap) : null,
    };
    if (!result.ok && (result.code === "provider_error" || result.code === "rate_limited")) stopReason = `erreur de l'API (${result.message}) : arrêt sans nouvelle tentative`;
  } catch (error) {
    guard.markUnknown(entry, `erreur inattendue : ${error instanceof Error ? error.name : "inconnue"}`);
    record = { caseId: step.caseId, model: step.model, pass: step.pass, servedModel: null, ok: false, code: "unexpected_error", message: error instanceof Error ? error.message : String(error), latencyMs: Date.now() - started, usage: null, costUsd: null, analysis: null, items: null };
    stopReason = "erreur inattendue : arrêt sans nouvelle tentative";
  }
  run.calls.push(record);
  writeJsonAtomic(ledgerPath, ledger);
  writeJsonAtomic(path.join(outDir, "resultats.json"), run);

  // 3. Compte rendu après chaque appel : jetons et coût réel.
  const u = record.usage;
  const served = record.servedModel && record.servedModel !== step.model ? ` (réponse de ${record.servedModel})` : "";
  console.log(
    `${modelLabel(step.model)}${served} · ${step.lc.case.room_label} (${step.caseId}) #${step.pass} : ${record.ok ? `${record.analysis?.objects.length ?? 0} objet(s)` : `ÉCHEC ${record.code}`}` +
      ` — ${(record.latencyMs / 1000).toFixed(1)} s — jetons ${u ? `${u.inputTokens} entrée, ${u.cacheWriteTokens} écrits en cache, ${u.cacheReadTokens} lus en cache, ${u.outputTokens} sortie` : "inconnus (réservation maximale conservée)"}` +
      ` — coût ${formatCostUsd(record.costUsd)} — campagne ${formatCostUsd(guard.campaignSpentUsd())} / ${formatCostUsd(guard.campaignCapUsd)}`,
  );
  if (stopReason) break;
}

run.finished_at = new Date().toISOString();
run.status = stopReason ? "interrompu" : "complet";
run.stop_reason = stopReason;
writeJsonAtomic(path.join(outDir, "resultats.json"), run);
if (stopReason) console.error(`\n✗ Arrêt : ${stopReason}.`);
writeReports(run, outDir, cases, ledger);
console.log(`Registre de la campagne : ${rel(ledgerPath)} (${formatCostUsd(guard.campaignSpentUsd())} comptés).`);
if (stopReason) process.exit(1);
