/**
 * Scénarios de reconnaissance : réponses de modèle FICTIVES (écrites à la main) confrontées à des
 * inventaires de référence annotés. Ils vérifient la chaîne de post-traitement (rattachement au
 * catalogue, dédoublonnage, volumes, calcul des écarts), PAS la qualité d'une IA réelle :
 * celle-ci ne pourra être mesurée qu'avec de vraies vidéos annotées (docs/analyse-ia.md).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildItems, type CatalogRef } from "./postprocess.ts";
import { evaluate, type ReferenceItem } from "./evaluate.ts";
import type { DetectedObject } from "./output.ts";
import { summarizeVolume } from "../inventory/volume.ts";

const ref = (id: string, name: string, vol: number | null, extra: Partial<CatalogRef> = {}): CatalogRef => ({
  id, name, synonyms: [], heavy: false, handling: "rigide",
  moving_volume_min: vol, moving_volume_avg: vol, moving_volume_max: vol, geometric_volume_avg: vol, ...extra,
});
const CATALOG = new Map(
  [
    ref("canape-3-places", "Canapé 3 places", 1.5, { synonyms: ["sofa"] }),
    ref("table-basse", "Table basse", 0.3),
    ref("chaise", "Chaise", 0.15),
    ref("table-a-manger-4", "Table à manger 4 personnes", 0.5),
    ref("refrigerateur", "Réfrigérateur", 0.4, { heavy: true }),
    ref("lave-linge", "Lave-linge", 0.3, { heavy: true }),
    ref("lit-double", "Lit double", 1.2),
    ref("armoire-2-portes", "Armoire 2 portes", 0.8),
    ref("carton-standard", "Carton standard", 0.1),
  ].map((r) => [r.id, r]),
);
const VOLUMES = new Map([...CATALOG.values()].map((r) => [r.id, r.moving_volume_avg ?? 0]));

const o = (catalog_id: string, extra: Partial<DetectedObject> = {}): DetectedObject => ({
  label: catalog_id, catalog_id, quantity: 1, confidence: 0.9, visibility: "visible", image_indexes: [0],
  dimensions_cm: null, is_fragile: false, needs_disassembly: false, may_be_same_as: "", location_in_room: "", distinctive_features: "", identity_doubt: null, notes: "", ...extra,
});
const frames = (n: number) => Array.from({ length: n }, (_, i) => `f${i}`);

test("Scénario 1 — séjour bien filmé : inventaire complet, volume exact", () => {
  const reference: ReferenceItem[] = [
    { room: "sejour", catalogKey: "canape-3-places", quantity: 1 },
    { room: "sejour", catalogKey: "table-basse", quantity: 1 },
    { room: "sejour", catalogKey: "chaise", quantity: 4 },
    { room: "sejour", catalogKey: "table-a-manger-4", quantity: 1 },
  ];
  const items = buildItems(
    [{ roomId: "sejour", frameIds: frames(4), objects: [o("canape-3-places", { image_indexes: [0, 1] }), o("table-basse"), o("chaise", { quantity: 4, image_indexes: [2, 3] }), o("table-a-manger-4", { image_indexes: [2] })] }],
    CATALOG,
  );
  const e = evaluate(items, reference, VOLUMES);
  assert.equal(e.recall, 1);
  assert.equal(e.precision, 1);
  assert.equal(e.volumeErrorM3, 0);
});

test("Scénario 2 — même canapé vu sous deux angles et listé deux fois (images disjointes) : signalé, compté, à trancher", () => {
  const reference: ReferenceItem[] = [{ room: "salon", catalogKey: "canape-3-places", quantity: 1 }];
  const items = buildItems(
    [{ roomId: "salon", frameIds: frames(3), objects: [o("canape-3-places", { image_indexes: [0, 1] }), o("canape-3-places", { label: "Sofa", catalog_id: "autre", image_indexes: [2] })] }],
    CATALOG,
  );
  assert.equal(items[1].catalogKey, "canape-3-places", "synonyme rattaché au catalogue");
  assert.equal(items[1].possibleDuplicate, true);
  const asInventory = (removed: boolean) => items.map((i, n) => ({ id: i.key, name: i.name, room: i.roomId, quantity: i.quantity, unitVolumeM3: i.unitVolumeM3, source: "ai" as const, confidence: i.confidence, possibleDuplicate: i.possibleDuplicate, removed: removed && n === 1 }));
  const before = summarizeVolume(asInventory(false));
  assert.equal(before.estimatedM3, 3, "tant que personne n'a tranché, les deux observations sont comptées");
  assert.equal(before.possibleDuplicateM3, 1.5);
  assert.equal(before.needsHumanReview, true);
  assert.equal(summarizeVolume(asInventory(true)).estimatedM3, 1.5, "après « Retirer » par le déménageur : un seul canapé");
  const e = evaluate(items, reference, VOLUMES);
  assert.equal(e.duplicatesFlaggedCorrectly, 1);
});

test("Scénario 3 — réfrigérateur visible depuis la cuisine ET le séjour (porte ouverte), signalé par l'IA", () => {
  const reference: ReferenceItem[] = [
    { room: "cuisine", catalogKey: "refrigerateur", quantity: 1 },
    { room: "sejour", catalogKey: "canape-3-places", quantity: 1 },
  ];
  const items = buildItems(
    [
      { roomId: "cuisine", frameIds: frames(2), objects: [o("refrigerateur")] },
      { roomId: "sejour", frameIds: frames(2), objects: [o("canape-3-places"), o("refrigerateur", { confidence: 0.7, visibility: "partial", identity_doubt: { other_entry_index: null, other_room: true, reason: "Aperçu par la porte de la cuisine" } })] },
    ],
    CATALOG,
  );
  const fridgeInSejour = items.find((i) => i.roomId === "sejour" && i.catalogKey === "refrigerateur");
  assert.equal(fridgeInSejour?.possibleDuplicate, true);
  const counted = summarizeVolume(items.map((i) => ({ id: i.key, name: i.name, room: i.roomId, quantity: i.quantity, unitVolumeM3: i.unitVolumeM3, source: "ai" as const, confidence: i.confidence, possibleDuplicate: i.possibleDuplicate })));
  assert.equal(counted.estimatedM3, 2.3, "le second réfrigérateur reste compté, à vérifier");
  assert.equal(counted.possibleDuplicateM3, 0.4);
  assert.equal(counted.needsHumanReview, true);
  const e = evaluate(items, reference, VOLUMES);
  assert.equal(e.duplicatesFlaggedCorrectly, 1);
});


test("Scénario 4 — objet inventé et objet manqué : écarts mesurés et signalés", () => {
  const reference: ReferenceItem[] = [
    { room: "chambre", catalogKey: "lit-double", quantity: 1 },
    { room: "chambre", catalogKey: "armoire-2-portes", quantity: 1 },
    { room: "chambre", catalogKey: "carton-standard", quantity: 6 },
  ];
  const items = buildItems(
    [{ roomId: "chambre", frameIds: frames(3), objects: [o("lit-double"), o("lave-linge", { confidence: 0.4, visibility: "uncertain" }), o("carton-standard", { quantity: 4, confidence: 0.7 })] }],
    CATALOG,
  );
  const e = evaluate(items, reference, VOLUMES);
  assert.deepEqual(e.missed.map((m) => [m.key, m.quantity]).sort(), [["armoire-2-portes", 1], ["carton-standard", 2]]);
  assert.deepEqual(e.hallucinated.map((h) => h.key), ["lave-linge"]);
  // L'objet inventé a un score bas : il reste « incertain » et n'est pas compté dans le volume estimé.
  const laveLinge = items.find((i) => i.catalogKey === "lave-linge")!;
  assert.ok(laveLinge.confidence < 0.6);
});

test("Scénario 5 — meuble hors catalogue : volume inconnu, jamais inventé", () => {
  const items = buildItems(
    [{ roomId: "bureau", frameIds: frames(1), objects: [o("autre", { label: "Vitrine de collection ancienne", confidence: 0.95 })] }],
    CATALOG,
  );
  assert.equal(items[0].catalogKey, null);
  assert.equal(items[0].volumeSource, "unknown");
  assert.equal(items[0].unitVolumeM3, 0);
  assert.ok(items[0].confidence <= 0.84, "à vérifier par le déménageur");
});

test("Évaluation : identifiants équivalents et objets facultatifs", () => {
  const reference: ReferenceItem[] = [
    { room: "salon", catalogKey: "canape-3-places", quantity: 1, alternatives: ["canape-2-places"] },
    { room: "salon", catalogKey: "table-basse", quantity: 1, optional: true },
  ];
  const catalog = new Map([...CATALOG, ["canape-2-places", ref("canape-2-places", "Canapé 2 places", 1)]]);
  const items = buildItems([{ roomId: "salon", frameIds: frames(2), objects: [o("canape-2-places"), o("table-basse")] }], catalog);
  const e = evaluate(items, reference, VOLUMES);
  assert.equal(e.recall, 1);
  assert.equal(e.precision, 1);
  assert.equal(e.hallucinated.length, 0);
  // Sans la table basse : aucun oubli compté (facultative).
  const e2 = evaluate(buildItems([{ roomId: "salon", frameIds: frames(1), objects: [o("canape-3-places")] }], catalog), reference, VOLUMES);
  assert.equal(e2.missed.length, 0);
});
