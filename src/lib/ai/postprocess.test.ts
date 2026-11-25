import { test } from "node:test";
import assert from "node:assert/strict";
import { buildItems, matchCatalog, unitVolume, type CatalogRef } from "./postprocess.ts";
import { parseRoomAnalysis, type DetectedObject } from "./output.ts";

const ref = (id: string, name: string, extra: Partial<CatalogRef> = {}): CatalogRef => ({
  id,
  name,
  synonyms: [],
  heavy: false,
  handling: "rigide",
  moving_volume_min: 1,
  moving_volume_avg: 1.5,
  moving_volume_max: 2,
  geometric_volume_avg: 1.7,
  ...extra,
});

const catalog = new Map(
  [
    ref("canape-3-places", "Canapé 3 places", { synonyms: ["sofa"] }),
    ref("refrigerateur", "Réfrigérateur", { heavy: true, moving_volume_avg: 0.4 }),
    ref("lampadaire", "Lampadaire", { moving_volume_avg: null, moving_volume_min: null, moving_volume_max: null, geometric_volume_avg: null }),
  ].map((r) => [r.id, r]),
);

const obj = (o: Partial<DetectedObject>): DetectedObject => ({
  label: "Canapé",
  catalog_id: "canape-3-places",
  quantity: 1,
  confidence: 0.9,
  visibility: "visible",
  image_indexes: [0, 1],
  dimensions_cm: null,
  is_fragile: false,
  needs_disassembly: false,
  may_be_same_as: "",
  location_in_room: "",
  distinctive_features: "",
  identity_doubt: null,
  notes: "",
  ...o,
});

test("rattachement au catalogue : identifiant, puis nom ou synonyme exact, jamais approximatif", () => {
  assert.equal(matchCatalog({ catalog_id: "canape-3-places", label: "x" }, catalog)?.id, "canape-3-places");
  assert.equal(matchCatalog({ catalog_id: "autre", label: "Sofa" }, catalog)?.id, "canape-3-places");
  assert.equal(matchCatalog({ catalog_id: "autre", label: "Canapé d'angle géant" }, catalog), null);
});

test("volume : catalogue, sinon dimensions × coefficient, sinon inconnu (0)", () => {
  assert.equal(unitVolume(catalog.get("canape-3-places")!, null).volumeSource, "catalog");
  const dims = unitVolume(catalog.get("lampadaire")!, { width: 40, depth: 40, height: 170 });
  assert.equal(dims.volumeSource, "dimensions");
  assert.equal(dims.unitVolumeM3, Math.round(0.272 * 1.1 * 1000) / 1000);
  const unknown = unitVolume(null, null);
  assert.equal(unknown.volumeSource, "unknown");
  assert.equal(unknown.unitVolumeM3, 0);
});

test("un volume calculé depuis des dimensions n'est jamais « sûr » ; un objet peu visible est « incertain »", () => {
  const items = buildItems(
    [{ roomId: "r1", frameIds: ["f0", "f1"], objects: [obj({ catalog_id: "lampadaire", label: "Lampadaire", confidence: 0.97, dimensions_cm: { width: 40, depth: 40, height: 170 } }), obj({ visibility: "uncertain", confidence: 0.95 })] }],
    catalog,
  );
  assert.equal(items[0].confidence, 0.84);
  assert.equal(items[1].confidence, 0.59);
});

test("dédoublonnage dans une pièce : visibles ensemble = distincts ; jamais ensemble = doublon possible, compté", () => {
  const items = buildItems(
    [{ roomId: "r1", frameIds: ["a", "b", "c"], objects: [obj({ image_indexes: [0, 1] }), obj({ image_indexes: [1, 0] }), obj({ image_indexes: [2] })] }],
    catalog,
  );
  assert.equal(items.length, 3, "aucune observation perdue");
  // Les deux premiers sont vus ensemble sur les images 0 et 1 : deux canapés distincts.
  assert.equal(items[1].possibleDuplicate, false);
  // Le troisième n'apparaît jamais avec le premier : peut-être le même filmé à un autre moment.
  assert.equal(items[2].possibleDuplicate, true);
  assert.equal(items[2].duplicateOfKey, items[0].key);
  assert.match(items[2].duplicateReason ?? "", /jamais visibles ensemble/);
  assert.deepEqual(items[0].frameIds, ["a", "b"]);
});

test("dédoublonnage entre pièces : jamais sur la seule référence ; seulement sur un doute explicite de l'IA", () => {
  const fridge = obj({ catalog_id: "refrigerateur", label: "Frigo" });
  const two = buildItems(
    [
      { roomId: "cuisine", frameIds: ["a", "b"], objects: [fridge] },
      { roomId: "garage", frameIds: ["c", "d"], objects: [fridge] },
    ],
    catalog,
  );
  assert.deepEqual(two.map((i) => i.possibleDuplicate), [false, false], "deux réfrigérateurs dans deux pièces : deux réfrigérateurs");
  assert.equal(two[0].isHeavy, true);
  const doubt = buildItems(
    [
      { roomId: "cuisine", frameIds: ["a", "b"], objects: [fridge] },
      { roomId: "salon", frameIds: ["c", "d"], objects: [obj({ catalog_id: "refrigerateur", label: "Frigo", visibility: "partial", identity_doubt: { other_entry_index: null, other_room: true, reason: "Vu par la porte ouverte de la cuisine" } })] },
    ],
    catalog,
  );
  assert.equal(doubt[1].possibleDuplicate, true);
  assert.equal(doubt[1].duplicateOfKey, doubt[0].key);
  assert.match(doubt[1].duplicateReason ?? "", /porte ouverte/);
});

test("sortie du modèle validée : forme stricte, indices d'images hors limites ignorés", () => {
  const parsed = parseRoomAnalysis(JSON.stringify({ objects: [obj({ image_indexes: [0, 5, 0] })], room_notes: "" }), 2);
  assert.deepEqual(parsed.objects[0].image_indexes, [0]);
  assert.throws(() => parseRoomAnalysis(JSON.stringify({ objects: [{ ...obj({}), confidence: 3 }], room_notes: "" }), 2));
  assert.throws(() => parseRoomAnalysis("pas du json", 2));
});

test("référence du catalogue sans volume : dimensions estimées → volume « à vérifier », sinon volume à renseigner", () => {
  const withDims = buildItems([{ roomId: "r", frameIds: ["f"], objects: [obj({ catalog_id: "lampadaire", label: "Lampadaire", confidence: 0.95, dimensions_cm: { width: 30, depth: 30, height: 160 } })] }], catalog);
  assert.equal(withDims[0].catalogKey, "lampadaire");
  assert.equal(withDims[0].volumeSource, "dimensions");
  assert.ok(withDims[0].unitVolumeM3 > 0);
  assert.ok(withDims[0].confidence <= 0.84);
  const noDims = buildItems([{ roomId: "r", frameIds: ["f"], objects: [obj({ catalog_id: "lampadaire", label: "Lampadaire" })] }], catalog);
  assert.equal(noDims[0].volumeSource, "unknown");
  assert.equal(noDims[0].unitVolumeM3, 0);
});
