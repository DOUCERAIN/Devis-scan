/**
 * Dédoublonnage : distinguer PLUSIEURS objets physiques (même identiques) d'UN objet vu plusieurs fois.
 *
 * Partie 1 : scénarios écrits à la main (réponses de modèle fictives) qui vérifient les règles.
 * Partie 2 : rejeu des réponses BRUTES réelles du benchmark du 25/11/2026 (aucun nouvel appel),
 * qui reproduit les erreurs constatées avec l'ancienne logique et vérifie qu'elles ont disparu.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildItems, GENERIC_IDENTITY_KEYS, type CatalogRef, type ItemDraft, type RoomDetections } from "./postprocess.ts";
import { roomAnalysisSchema, type DetectedObject } from "./output.ts";
import { summarizeVolume } from "../inventory/volume.ts";

const ref = (id: string, name: string, vol: number | null): CatalogRef => ({
  id, name, synonyms: [], heavy: false, handling: "rigide",
  moving_volume_min: vol, moving_volume_avg: vol, moving_volume_max: vol, geometric_volume_avg: vol,
});
const CATALOG = new Map(
  [
    ref("lit-simple", "Lit simple", 0.8),
    ref("lit-double", "Lit double", 1.2),
    ref("chaise", "Chaise", 0.15),
    ref("table-a-manger-4", "Table à manger 4 personnes", 0.5),
    ref("canape-3-places", "Canapé 3 places", 1.5),
    ref("carton-standard", "Carton standard", 0.1),
    ref("armoire-2-portes", "Armoire 2 portes", 0.8),
    ref("autre-objet", "Autre objet", null),
  ].map((r) => [r.id, r]),
);
const o = (catalog_id: string, extra: Partial<DetectedObject> = {}): DetectedObject => ({
  label: catalog_id, catalog_id, quantity: 1, confidence: 0.9, visibility: "visible", image_indexes: [0], dimensions_cm: null,
  is_fragile: false, needs_disassembly: false, may_be_same_as: "", location_in_room: "", distinctive_features: "", identity_doubt: null, notes: "", ...extra,
});
const room = (roomId: string, objects: DetectedObject[], frames = 8): RoomDetections => ({ roomId, objects, frameIds: Array.from({ length: frames }, (_, i) => `${roomId}-${i}`) });

/** Volume et quantités tels que le déménageur et le devis les voient. */
function inventory(items: ItemDraft[], removedKeys: string[] = []) {
  const asItems = items.map((i) => ({ id: i.key, name: i.name, room: i.roomId, quantity: i.quantity, unitVolumeM3: i.unitVolumeM3, source: "ai" as const, confidence: i.confidence, possibleDuplicate: i.possibleDuplicate, removed: removedKeys.includes(i.key) }));
  const counted = (key: string) => asItems.filter((i) => !i.removed && items.find((x) => x.key === i.id)?.catalogKey === key).reduce((s, i) => s + i.quantity, 0);
  return { summary: summarizeVolume(asItems), counted, flagged: items.filter((i) => i.possibleDuplicate).length };
}

// ---------- Partie 1 : scénarios ----------

test("1. Deux lits identiques dans deux chambres : 2 lits, aucun signalement", () => {
  const same = { location_in_room: "contre le mur du fond", distinctive_features: "tête de lit en pin, couette grise" };
  const items = buildItems([room("chambre-1", [o("lit-simple", same)]), room("chambre-2", [o("lit-simple", same)])], CATALOG);
  const inv = inventory(items);
  assert.equal(inv.counted("lit-simple"), 2);
  assert.equal(inv.flagged, 0, "même catégorie, même apparence : jamais suffisant pour conclure au même lit");
  assert.equal(inv.summary.estimatedM3, 1.6);
});

test("2. Deux lits différents dans une même chambre, visibles ensemble : 2 lits", () => {
  const items = buildItems([room("chambre", [o("lit-simple", { image_indexes: [0, 1, 2], location_in_room: "à gauche" }), o("lit-simple", { image_indexes: [1, 2, 3], visibility: "partial", location_in_room: "à droite, derrière la cloison" })])], CATALOG);
  const inv = inventory(items);
  assert.equal(inv.counted("lit-simple"), 2);
  assert.equal(inv.flagged, 0, "vus ensemble sur les images 1 et 2 : deux objets distincts");
});

test("3. Quatre chaises identiques autour d'une table : 4 chaises (une entrée × 4, ou quatre entrées vues ensemble)", () => {
  const grouped = buildItems([room("cuisine", [o("table-a-manger-4", { image_indexes: [0, 1] }), o("chaise", { quantity: 4, image_indexes: [0, 1] })])], CATALOG);
  assert.equal(inventory(grouped).counted("chaise"), 4);
  assert.equal(inventory(grouped).flagged, 0);
  const separate = buildItems([room("cuisine", [0, 1, 2, 3].map((n) => o("chaise", { image_indexes: [0, 1], location_in_room: `côté ${n + 1} de la table` })))], CATALOG);
  assert.equal(inventory(separate).counted("chaise"), 4);
  assert.equal(inventory(separate).flagged, 0);
  assert.equal(inventory(separate).summary.estimatedM3, 0.6);
});

test("4. Deux canapés identiques dans deux pièces : 2 canapés", () => {
  const sofa = o("canape-3-places", { distinctive_features: "velours bleu, pieds noirs" });
  const items = buildItems([room("salon", [sofa]), room("bureau", [sofa])], CATALOG);
  assert.equal(inventory(items).counted("canape-3-places"), 2);
  assert.equal(inventory(items).flagged, 0);
});

test("5. Un canapé filmé sous trois angles : regroupé par le modèle → 1 canapé ; listé deux fois → signalé, compté, tranché par une personne", () => {
  const grouped = buildItems([room("salon", [o("canape-3-places", { image_indexes: [0, 3, 6] })])], CATALOG);
  assert.equal(inventory(grouped).counted("canape-3-places"), 1);
  assert.deepEqual(grouped[0].frameIds, ["salon-0", "salon-3", "salon-6"]);

  const twice = buildItems([room("salon", [o("canape-3-places", { image_indexes: [0, 1], location_in_room: "face à la fenêtre" }), o("canape-3-places", { image_indexes: [5, 6], location_in_room: "face à la fenêtre, vu de dos" })])], CATALOG);
  assert.equal(twice.length, 2, "aucune observation perdue");
  assert.equal(twice[1].possibleDuplicate, true);
  assert.equal(twice[1].duplicateOfKey, twice[0].key);
  assert.match(twice[1].duplicateReason ?? "", /face à la fenêtre » \/ « face à la fenêtre, vu de dos/);
  const before = inventory(twice);
  assert.equal(before.summary.estimatedM3, 3, "compté tant que personne n'a tranché (jamais retiré automatiquement)");
  assert.equal(before.summary.possibleDuplicateM3, 1.5);
  assert.equal(before.summary.needsHumanReview, true);
  assert.equal(inventory(twice, [twice[1].key]).summary.estimatedM3, 1.5, "après « Retirer » : 1 canapé");
});

test("6. Un même meuble visible sur plusieurs images : une seule entrée, toutes ses images conservées", () => {
  const items = buildItems([room("chambre", [o("armoire-2-portes", { image_indexes: [0, 1, 2, 3, 4, 5, 6, 7] })])], CATALOG);
  assert.equal(items.length, 1);
  assert.equal(inventory(items).counted("armoire-2-portes"), 1);
  assert.equal(items[0].frameIds.length, 8);
  assert.equal(items[0].possibleDuplicate, false);
});

test("7. Deux objets différents classés « Autre objet » : jamais comparés, jamais signalés", () => {
  assert.ok(GENERIC_IDENTITY_KEYS.has("autre-objet"));
  const items = buildItems([room("bureau", [
    o("autre-objet", { label: "Ventilateur ancien", image_indexes: [0], dimensions_cm: { width: 40, depth: 25, height: 50 } }),
    o("autre-objet", { label: "Figurine", image_indexes: [5], dimensions_cm: { width: 10, depth: 10, height: 20 } }),
    o("autre", { label: "Lampe à lave", image_indexes: [6] }),
  ])], CATALOG);
  assert.equal(items.filter((i) => i.possibleDuplicate).length, 0);
  assert.equal(items.length, 3);
});

test("8. Deux cartons identiques mais distincts : 2 cartons, qu'ils soient vus ensemble ou listés en quantité", () => {
  const together = buildItems([room("entree", [o("carton-standard", { image_indexes: [0, 1] }), o("carton-standard", { image_indexes: [1] })])], CATALOG);
  assert.equal(inventory(together).counted("carton-standard"), 2);
  assert.equal(inventory(together).flagged, 0);
  const asQuantity = buildItems([room("entree", [o("carton-standard", { quantity: 2 })])], CATALOG);
  assert.equal(inventory(asQuantity).counted("carton-standard"), 2);
  // Vus à deux moments différents : signalés pour vérification, mais les deux restent comptés.
  const apart = buildItems([room("entree", [o("carton-standard", { image_indexes: [0] }), o("carton-standard", { image_indexes: [7] })])], CATALOG);
  assert.equal(inventory(apart).counted("carton-standard"), 2);
  assert.equal(inventory(apart).summary.estimatedM3, 0.2);
});

test("9. Objet partiellement caché : conservé et compté, distinct du meuble visible à côté", () => {
  const items = buildItems([room("salle", [
    o("chaise", { image_indexes: [2, 3] }),
    o("chaise", { image_indexes: [3], visibility: "partial", confidence: 0.7, location_in_room: "derrière la table" }),
  ])], CATALOG);
  const inv = inventory(items);
  assert.equal(inv.counted("chaise"), 2);
  assert.equal(inv.flagged, 0);
  assert.equal(items[1].visibility, "partial");
  assert.equal(inv.summary.toVerifyM3, 0.2, "confiance moyenne : comptée « à vérifier »");
});

test("10. Cas ambigu signalé par le modèle : les deux observations gardées, comptées, validation humaine demandée", () => {
  const items = buildItems([room("chambre", [
    o("armoire-2-portes", { image_indexes: [0, 1, 2] }),
    o("armoire-2-portes", { image_indexes: [2, 3], identity_doubt: { other_entry_index: 0, other_room: false, reason: "Même couleur et même poignée, angle très différent : peut-être la même armoire" } }),
  ])], CATALOG);
  assert.equal(items.length, 2);
  assert.equal(items[1].possibleDuplicate, true, "le doute explicite du modèle l'emporte sur la co-visibilité");
  assert.equal(items[1].duplicateOfKey, items[0].key);
  assert.match(items[1].duplicateReason ?? "", /Doute signalé par l'IA : Même couleur/);
  const inv = inventory(items);
  assert.equal(inv.summary.estimatedM3, 1.6);
  assert.equal(inv.summary.itemsToReview, 1);
  assert.equal(inv.summary.needsHumanReview, true);
});

test("format de sortie : renvoi d'un doute vers une entrée inexistante ou vers elle-même neutralisé ; anciennes réponses relues", () => {
  const legacy = roomAnalysisSchema.parse({ objects: [{ label: "Lit", catalog_id: "lit-simple", quantity: 1, confidence: 0.9, visibility: "visible", image_indexes: [0], dimensions_cm: null, is_fragile: false, needs_disassembly: false, may_be_same_as: "", notes: "" }], room_notes: "" });
  assert.equal(legacy.objects[0].identity_doubt, null);
  assert.equal(legacy.objects[0].location_in_room, "");
});

// ---------- Partie 2 : rejeu du benchmark réel du 25/11/2026 (aucun appel) ----------

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../../..");
const RUN = path.join(root, "tests/ai-eval/results/2026-11-25T09-46-03-455-003e/resultats.json");
type Call = { caseId: string; model: string; ok: boolean; analysis: unknown; items: { aiLabel: string; catalogKey: string | null; possibleDuplicate: boolean }[] };
const run = JSON.parse(fs.readFileSync(RUN, "utf8")) as { calls: Call[] };
const catalogJson = JSON.parse(fs.readFileSync(path.join(root, "data/catalog/catalog.json"), "utf8")) as { items: { id: string; name: string; synonyms: string[]; heavy: boolean; handling: string; moving_volume_m3: { min: number; avg: number; max: number } | null; geometric_volume_m3: { avg: number } | null }[] };
const REAL_CATALOG = new Map<string, CatalogRef>(catalogJson.items.map((i) => [i.id, {
  id: i.id, name: i.name, synonyms: i.synonyms, heavy: i.heavy, handling: i.handling,
  moving_volume_min: i.moving_volume_m3?.min ?? null, moving_volume_avg: i.moving_volume_m3?.avg ?? null, moving_volume_max: i.moving_volume_m3?.max ?? null, geometric_volume_avg: i.geometric_volume_m3?.avg ?? null,
}]));
const rebuild = (c: Call) => buildItems([{ roomId: c.caseId, objects: roomAnalysisSchema.parse(c.analysis).objects, frameIds: Array.from({ length: 8 }, (_, i) => `${String(i).padStart(2, "0")}.jpg`) }], REAL_CATALOG);
const call = (caseId: string, model: string) => run.calls.find((c) => c.caseId === caseId && c.model === model)!;

test("benchmark — erreurs constatées avec l'ancienne logique (enregistrées le 25/11/2026)", () => {
  const old = run.calls.flatMap((c) => c.items);
  assert.equal(old.filter((i) => i.possibleDuplicate).length, 21, "21 objets écartés du volume : 15 « Autre objet », 2 cadres, 2 sacs, 1 miroir, 1 lit");
  assert.equal(old.filter((i) => i.possibleDuplicate && i.catalogKey === "autre-objet").length, 15, "dont 15 « Autre objet » différents");
  const haikuBeds = call("chambre-lits-simples", "claude-haiku-5-5").items.filter((i) => i.catalogKey === "lit-simple");
  assert.deepEqual(haikuBeds.map((b) => b.possibleDuplicate), [false, true], "le second lit de Haiku était écarté du volume");
});

test("benchmark — nouvelle logique : plus aucun meuble écarté, aucune observation perdue", () => {
  for (const c of run.calls) {
    const items = rebuild(c);
    assert.equal(items.length, roomAnalysisSchema.parse(c.analysis).objects.length, `${c.caseId}/${c.model} : toutes les observations conservées`);
    assert.equal(items.filter((i) => i.possibleDuplicate && i.catalogKey !== null && GENERIC_IDENTITY_KEYS.has(i.catalogKey)).length, 0, `${c.caseId}/${c.model} : aucun objet générique comparé`);
  }
  const haiku = rebuild(call("chambre-lits-simples", "claude-haiku-5-5"));
  const beds = haiku.filter((i) => i.catalogKey === "lit-simple");
  assert.equal(beds.length, 2);
  assert.ok(beds.every((b) => !b.possibleDuplicate), "les deux lits, vus ensemble, sont deux lits");
  assert.equal(inventory(haiku).counted("lit-simple"), 2);
  // Ancien champ libre d'Opus (« Probablement situé dans l'entrée/couloir ») : une position, pas un doublon.
  const mirror = rebuild(call("chambre-lits-simples", "claude-opus-5-5")).find((i) => i.catalogKey === "miroir-mural")!;
  assert.equal(mirror.possibleDuplicate, false);
  // Sur ces réponses, tous les objets d'une pièce partagent des images : aucun signalement du tout.
  assert.equal(run.calls.reduce((s, c) => s + rebuild(c).filter((i) => i.possibleDuplicate).length, 0), 0);
});
