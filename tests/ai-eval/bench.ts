/**
 * Banc de comparaison RÉEL des modèles Claude sur les mêmes images (aucune simulation).
 *
 * Images : tests/ai-eval/frames/ (extraites par le pipeline de la phase 3, voir prepare-frames.e2e.cjs).
 * Référence : tests/ai-eval/reference.json. Catalogue : data/catalog/catalog.json.
 *
 * Lancer (clé dans la variable d'environnement ANTHROPIC_API_KEY, jamais dans un fichier) :
 *   node --conditions=react-server tests/ai-eval/bench.ts --confirm
 * Options : --models haiku,sonnet,opus  --effort medium  --repeat 1  --max-usd 5
 *
 * Sans --confirm, le script affiche seulement l'estimation du coût et s'arrête.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { AnthropicVisionProvider } from "../../src/lib/ai/providers/anthropic.ts";
import { catalogPrompt } from "../../src/lib/ai/prompt.ts";
import { buildItems, type CatalogRef, type ItemDraft, type RoomDetections } from "../../src/lib/ai/postprocess.ts";
import { evaluate, type ReferenceItem, type Evaluation } from "../../src/lib/ai/evaluate.ts";
import { estimateCostUsd, MODEL_PRICES_USD, type TokenUsage } from "../../src/lib/ai/cost.ts";
import type { RoomImage } from "../../src/lib/ai/provider.ts";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../..");
const arg = (name: string, fallback: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : fallback;
};
const MODELS: Record<string, string> = { haiku: "claude-haiku-5-5", sonnet: "claude-sonnet-5-5", opus: "claude-opus-5-5" };
const models = arg("models", "haiku,sonnet,opus").split(",").map((m) => MODELS[m.trim()] ?? m.trim());
const effort = arg("effort", "medium") as "low" | "medium" | "high";
const repeat = Math.max(1, Number(arg("repeat", "1")));
const maxUsd = Number(arg("max-usd", "5"));
const confirm = process.argv.includes("--confirm");

type Manifest = { rooms: { id: string; label: string; frames: { file: string; width: number; height: number }[] }[] };
const manifest: Manifest = JSON.parse(fs.readFileSync(path.join(here, "frames/manifest.json"), "utf8"));
const reference = JSON.parse(fs.readFileSync(path.join(here, "reference.json"), "utf8"));
type CatalogJson = { items: { id: string; name: string; synonyms: string[]; heavy: boolean; handling: string; moving_volume_m3: { min: number; avg: number; max: number } | null; geometric_volume_m3: { avg: number } | null }[] };
const catalogJson: CatalogJson = JSON.parse(fs.readFileSync(path.join(root, "data/catalog/catalog.json"), "utf8"));
const catalog: CatalogRef[] = catalogJson.items.map((i) => ({
  id: i.id, name: i.name, synonyms: i.synonyms, heavy: i.heavy, handling: i.handling,
  moving_volume_min: i.moving_volume_m3?.min ?? null, moving_volume_avg: i.moving_volume_m3?.avg ?? null,
  moving_volume_max: i.moving_volume_m3?.max ?? null, geometric_volume_avg: i.geometric_volume_m3?.avg ?? null,
}));
const catalogMap = new Map(catalog.map((c) => [c.id, c]));
const catalogText = catalogPrompt(catalog);
const volumes = new Map(catalog.map((c) => [c.id, c.moving_volume_avg ?? 0]));
const refItems: ReferenceItem[] = manifest.rooms.flatMap((r) =>
  (reference.rooms[r.id]?.items ?? []).map((i: { key: string; quantity: number; alternatives?: string[]; optional?: boolean }) => ({
    room: r.id, catalogKey: i.key, quantity: i.quantity, alternatives: i.alternatives, optional: i.optional,
  })),
);

// Estimation préalable (jetons d'image ≈ largeur × hauteur / 750, approximation documentée par Anthropic).
const imageTokens = manifest.rooms.reduce((s, r) => s + r.frames.reduce((t, f) => t + Math.ceil((f.width * f.height) / 750), 0), 0);
const textTokens = manifest.rooms.length * 6000;
const outTokens = manifest.rooms.length * 5000;
let estimate = 0;
for (const m of models) {
  const p = MODEL_PRICES_USD[m];
  if (!p) throw new Error(`Modèle sans tarif connu : ${m}`);
  estimate += (((imageTokens + textTokens) * p.input + outTokens * p.output) / 1e6) * repeat;
}
console.log(`${manifest.rooms.length} pièces, ${manifest.rooms.reduce((s, r) => s + r.frames.length, 0)} images, modèles : ${models.join(", ")}, ${repeat} passage(s).`);
console.log(`Coût maximal estimé : ${estimate.toFixed(2)} $ (plafond --max-usd ${maxUsd} $).`);
if (estimate > maxUsd) {
  console.error("Estimation au-dessus du plafond : arrêt.");
  process.exit(2);
}
if (!confirm) {
  console.log("Ajoutez --confirm pour lancer les appels réels (facturés au titulaire de la clé).");
  process.exit(0);
}
const apiKey = process.env.ANTHROPIC_API_KEY;
if (!apiKey) {
  console.error("ANTHROPIC_API_KEY absente : aucun appel possible (voir docs/connexion-cle-anthropic.md).");
  process.exit(3);
}

type RoomRun = { room: string; ok: boolean; code?: string; message?: string; latencyMs: number; usage: TokenUsage; costUsd: number | null; model: string; objects?: unknown };
type ModelRun = { model: string; pass: number; rooms: RoomRun[]; items: ItemDraft[]; evaluation: Evaluation; costUsd: number; latencyMs: number };
const runs: ModelRun[] = [];

for (const model of models) {
  for (let pass = 1; pass <= repeat; pass++) {
    const provider = new AnthropicVisionProvider(apiKey, model, effort);
    const rooms: RoomRun[] = [];
    const detections: RoomDetections[] = [];
    for (const room of manifest.rooms) {
      const images: RoomImage[] = room.frames.map((f) => ({ mediaType: "image/jpeg", base64: fs.readFileSync(path.join(here, "frames", room.id, f.file)).toString("base64") }));
      const started = Date.now();
      const result = await provider.analyzeRoom({ roomName: room.label, roomDescription: null, images, catalogText });
      const latencyMs = Date.now() - started;
      const costUsd = estimateCostUsd(model, result.usage);
      if (result.ok) {
        detections.push({ roomId: room.id, objects: result.analysis.objects, frameIds: room.frames.map((f) => f.file) });
        rooms.push({ room: room.id, ok: true, latencyMs, usage: result.usage, costUsd, model: result.model, objects: result.analysis });
      } else {
        rooms.push({ room: room.id, ok: false, code: result.code, message: result.message, latencyMs, usage: result.usage, costUsd, model: result.model });
      }
      console.log(`${model} #${pass} ${room.label} : ${result.ok ? `${result.analysis.objects.length} objets` : `ÉCHEC ${result.code}`} — ${(latencyMs / 1000).toFixed(1)} s, ${costUsd?.toFixed(4)} $`);
    }
    const items = buildItems(detections, catalogMap);
    const evaluation = evaluate(items, refItems, volumes);
    runs.push({ model, pass, rooms, items, evaluation, costUsd: rooms.reduce((s, r) => s + (r.costUsd ?? 0), 0), latencyMs: rooms.reduce((s, r) => s + r.latencyMs, 0) });
  }
}

// Rapport
const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const outDir = path.join(here, "results");
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, `${stamp}.json`), JSON.stringify({ date: new Date().toISOString(), effort, repeat, reference_note: reference.annotated_by, runs }, null, 2));
const pct = (n: number) => `${Math.round(n * 100)} %`;
const lines = [
  `# Comparaison réelle des modèles — ${new Date().toLocaleString("fr-FR", { timeZone: "Europe/Paris" })}`,
  "",
  `Images : ${manifest.rooms.length} pièces, ${manifest.rooms.reduce((s, r) => s + r.frames.length, 0)} images extraites par la phase 3. Effort : ${effort}. Passages : ${repeat}.`,
  `Référence : ${reference.annotated_by}`,
  "",
  "| Modèle | Passage | Coût total | Coût moyen / pièce | Durée totale | Rappel | Précision | Inventés | Oubliés | Doublons signalés | Écart volume | Échecs |",
  "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
  ...runs.map((r) =>
    `| ${r.model} | ${r.pass} | ${r.costUsd.toFixed(4)} $ | ${(r.costUsd / r.rooms.length).toFixed(4)} $ | ${(r.latencyMs / 1000).toFixed(0)} s | ${pct(r.evaluation.recall)} | ${pct(r.evaluation.precision)} | ${r.evaluation.hallucinated.reduce((s, h) => s + h.quantity, 0)} | ${r.evaluation.missed.reduce((s, m) => s + m.quantity, 0)} | ${r.evaluation.duplicatesFlaggedCorrectly} / ${r.items.filter((i) => i.possibleDuplicate).length} | ${r.evaluation.volumeErrorM3.toLocaleString("fr-FR")} m³ | ${r.rooms.filter((x) => !x.ok).length} |`),
  "",
  "## Détail des écarts",
  ...runs.flatMap((r) => [
    "",
    `### ${r.model} (passage ${r.pass})`,
    `- Objets inventés : ${r.evaluation.hallucinated.map((h) => `${h.room} → ${h.key} ×${h.quantity}`).join(" ; ") || "aucun"}`,
    `- Objets oubliés : ${r.evaluation.missed.map((m) => `${m.room} → ${m.key} ×${m.quantity}`).join(" ; ") || "aucun"}`,
    `- Doublons possibles : ${r.items.filter((i) => i.possibleDuplicate).map((i) => `${i.roomId} → ${i.name}`).join(" ; ") || "aucun"}`,
    `- Objets hors catalogue ou sans volume : ${r.items.filter((i) => i.volumeSource !== "catalog").map((i) => `${i.roomId} → ${i.name} (${i.volumeSource})`).join(" ; ") || "aucun"}`,
    `- Échecs : ${r.rooms.filter((x) => !x.ok).map((x) => `${x.room} : ${x.code}`).join(" ; ") || "aucun"}`,
  ]),
];
fs.writeFileSync(path.join(outDir, `${stamp}.md`), lines.join("\n") + "\n");
console.log(`\nRapport : tests/ai-eval/results/${stamp}.md`);
