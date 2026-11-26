import { test } from "node:test";
import assert from "node:assert/strict";
import { chunkBalanced, mergeBatchDetections, orderHomeFrames, planHomeBatches, spreadEvenly, MAX_HOME_IMAGES, HOME_BATCH_SIZE } from "./batches.ts";
import { buildItems, type CatalogRef } from "../ai/postprocess.ts";
import { SIMULATED_HOME_PARTS } from "../ai/providers/simulation.ts";

const frame = (id: string, video: string, ms: number) => ({ id, storage_path: `p/${id}.jpg`, captured_at_ms: ms, videoCreatedAt: video });

test("lots équilibrés, ordre conservé", () => {
  assert.deepEqual(chunkBalanced([1, 2, 3, 4, 5], 2).map((c) => c.length), [2, 2, 1]);
  assert.deepEqual(chunkBalanced(Array.from({ length: 41 }, (_, i) => i), 20).map((c) => c.length), [14, 14, 13]);
  assert.deepEqual(chunkBalanced([], 20), []);
  assert.deepEqual(chunkBalanced([1, 2, 3], 20), [[1, 2, 3]]);
});

test("répartition uniforme plafonnée", () => {
  assert.equal(spreadEvenly(Array.from({ length: 200 }, (_, i) => i), 60).length, 60);
  assert.deepEqual(spreadEvenly([1, 2, 3], 60), [1, 2, 3]);
});

test("ordre de prise de vue : média par média puis instant", () => {
  const order = orderHomeFrames([frame("b2", "2026-12-02T10:01", 500), frame("a2", "2026-12-02T10:00", 900), frame("a1", "2026-12-02T10:00", 100), frame("photo", "2026-12-02T10:02", 0)]);
  assert.deepEqual(order.map((f) => f.id), ["a1", "a2", "b2", "photo"]);
});

test("une seule vidéo courte : un seul appel ; beaucoup de médias : plafond et lots", () => {
  assert.equal(planHomeBatches(Array.from({ length: 8 }, (_, i) => frame(`f${i}`, "v1", i * 100))).length, 1);
  const many = Array.from({ length: 150 }, (_, i) => frame(`f${i}`, `v${Math.floor(i / 8)}`, (i % 8) * 100));
  const batches = planHomeBatches(many);
  assert.equal(batches.flat().length, MAX_HOME_IMAGES);
  assert.ok(batches.every((b) => b.length <= HOME_BATCH_SIZE));
  assert.equal(batches.length, 3);
});

test("fusion des lots : indices d'images et d'entrées décalés", () => {
  const merged = mergeBatchDetections([
    { objects: SIMULATED_HOME_PARTS[0].map((o) => ({ ...o, image_indexes: [0] })), frameIds: ["a", "b"] },
    {
      objects: [{ ...SIMULATED_HOME_PARTS[1][0], image_indexes: [1], identity_doubt: { other_entry_index: 0, other_room: false, reason: "test" } }],
      frameIds: ["c", "d"],
    },
  ]);
  assert.deepEqual(merged.frameIds, ["a", "b", "c", "d"]);
  const last = merged.objects.at(-1)!;
  assert.deepEqual(last.image_indexes, [3]);
  assert.equal(last.identity_doubt?.other_entry_index, SIMULATED_HOME_PARTS[0].length);
});

test("un meuble repéré dans deux lots est signalé comme doublon possible, jamais retiré", () => {
  const ref = (id: string, name: string): CatalogRef => ({ id, name, synonyms: [], heavy: false, handling: "rigide", moving_volume_min: 1, moving_volume_avg: 1.5, moving_volume_max: 2, geometric_volume_avg: 1.4 });
  const catalog = new Map(["canape-3-places", "table-basse", "meuble-tv", "lampadaire", "chaise", "refrigerateur", "lit-double", "armoire-2-portes", "table-de-chevet", "carton-standard"].map((id) => [id, ref(id, id)]));
  const merged = mergeBatchDetections([
    { objects: SIMULATED_HOME_PARTS[0], frameIds: ["f0", "f1", "f2"] },
    { objects: SIMULATED_HOME_PARTS[1], frameIds: ["f3", "f4"] },
  ]);
  const items = buildItems([{ roomId: "logement", ...merged }], catalog);
  assert.equal(items.length, SIMULATED_HOME_PARTS[0].length + SIMULATED_HOME_PARTS[1].length, "aucun objet retiré");
  const sofas = items.filter((i) => i.catalogKey === "canape-3-places");
  assert.equal(sofas.length, 2);
  assert.equal(sofas[1].possibleDuplicate, true, "le canapé vu dans le second lot est à vérifier");
  assert.equal(sofas[0].possibleDuplicate, false);
  assert.deepEqual(sofas[1].frameIds, ["f3"], "images d'origine conservées");
});
