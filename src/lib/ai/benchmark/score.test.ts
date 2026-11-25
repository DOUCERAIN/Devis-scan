/**
 * Tests de la notation avec des détections ÉCRITES À LA MAIN (pas des résultats de modèle) :
 * ils vérifient les règles de calcul, pas la qualité d'une IA.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { scoreCase, summarizeModel, suggestCompromise, QUALITY_WEIGHTS, type CatalogInfo, type Detected } from "./score.ts";
import type { CaseReferenceItem } from "./dataset.ts";

const CATALOG = new Map<string, CatalogInfo>([
  ["canape-3-places", { subcategory: "Canapés", movingVolumeAvg: 1.5 }],
  ["canape-2-places", { subcategory: "Canapés", movingVolumeAvg: 1.0 }],
  ["table-basse", { subcategory: "Tables", movingVolumeAvg: 0.3 }],
  ["chaise", { subcategory: "Chaises", movingVolumeAvg: 0.15 }],
  ["bibliotheque", { subcategory: "Rangements", movingVolumeAvg: 1.0 }],
  ["etagere", { subcategory: "Rangements", movingVolumeAvg: 0.5 }],
  ["lampe-a-poser", { subcategory: "Luminaires", movingVolumeAvg: null }],
]);
const ref = (key: string, quantity: number, extra: Partial<CaseReferenceItem> = {}): CaseReferenceItem => ({
  key, quantity, alternatives: [], optional: false, partial: false, difficult: false, volume_m3: null, views: [], comment: "", ...extra,
});
const det = (catalogKey: string | null, quantity: number, extra: Partial<Detected> = {}): Detected => ({
  catalogKey, name: catalogKey ?? "objet inconnu", quantity, possibleDuplicate: false,
  unitVolumeM3: (catalogKey && CATALOG.get(catalogKey)?.movingVolumeAvg) || 0, volumeSource: "catalog", ...extra,
});

test("analyse parfaite : tout correct, aucune erreur, volume exact", () => {
  const s = scoreCase("salon", [det("canape-3-places", 1), det("table-basse", 1)], [ref("canape-3-places", 1), ref("table-basse", 1)], CATALOG);
  assert.equal(s.correct, 2);
  assert.deepEqual([s.missed, s.invented, s.overcounted], [[], [], []]);
  assert.equal(s.volume.errorM3, 0);
});

test("oubli, invention et surcomptage (même meuble compté deux fois) sont distingués", () => {
  const s = scoreCase("salon", [det("canape-3-places", 2), det("chaise", 1)], [ref("canape-3-places", 1), ref("table-basse", 1)], CATALOG);
  assert.equal(s.correct, 1);
  assert.deepEqual(s.missed, [{ key: "table-basse", quantity: 1 }]);
  assert.deepEqual(s.overcounted, [{ key: "canape-3-places", quantity: 1 }]);
  assert.deepEqual(s.invented, [{ key: "chaise", quantity: 1 }]);
  // Volume compté 3,15 m³ pour une référence de 1,8 m³
  assert.equal(s.volume.errorM3, 1.35);
});

test("alternatives acceptées et objets facultatifs neutres", () => {
  const reference = [ref("bibliotheque", 2, { alternatives: ["etagere"] }), ref("lampe-a-poser", 1, { optional: true })];
  const s = scoreCase("bureau", [det("etagere", 2), det("lampe-a-poser", 1)], reference, CATALOG);
  assert.equal(s.correct, 2);
  assert.deepEqual(s.invented, []);
  const s2 = scoreCase("bureau", [det("etagere", 2)], reference, CATALOG);
  assert.deepEqual(s2.missed, [], "facultatif absent : pas un oubli");
});

test("catégorie : mauvais modèle de canapé = erreur d'objet mais bonne catégorie", () => {
  const s = scoreCase("salon", [det("canape-2-places", 1)], [ref("canape-3-places", 1)], CATALOG);
  assert.equal(s.correct, 0);
  assert.equal(s.category.correct, 1);
  const s2 = scoreCase("salon", [det(null, 1, { name: "sofa" })], [ref("canape-3-places", 1)], CATALOG);
  assert.equal(s2.category.correct, 0, "hors catalogue : catégorie inconnue");
  assert.equal(s2.outsideCatalog, 1);
});

test("meubles partiellement cachés : comptés retrouvés seulement après les visibles", () => {
  const reference = [ref("chaise", 1), ref("chaise", 1, { partial: true, difficult: true })];
  assert.deepEqual(scoreCase("c", [det("chaise", 1)], reference, CATALOG).partial, { total: 1, found: 0 });
  assert.deepEqual(scoreCase("c", [det("chaise", 2)], reference, CATALOG).partial, { total: 1, found: 1 });
  assert.deepEqual(scoreCase("c", [det("chaise", 2)], reference, CATALOG).difficult, { total: 1, found: 1 });
});

test("doublons possibles : toujours comptés, signalement justifié (vrai surcomptage) ou fausse alerte", () => {
  const reference = [ref("canape-3-places", 1), ref("chaise", 2)];
  const s = scoreCase("salon", [det("canape-3-places", 1, { possibleDuplicate: true }), det("canape-3-places", 1), det("chaise", 1), det("chaise", 1, { possibleDuplicate: true })], reference, CATALOG);
  assert.equal(s.correct, 3, "la 2e chaise, signalée à tort, reste comptée : aucun meuble réel perdu");
  assert.deepEqual(s.overcounted, [{ key: "canape-3-places", quantity: 1 }], "le canapé vu deux fois est compté deux fois tant qu'une personne n'a pas tranché");
  assert.deepEqual(s.duplicates, { flagged: 2, justified: 1, falseAlarm: 1 });
  assert.equal(s.volume.countedM3, 3.3);
});

test("volume : fourchette obligatoires → facultatifs, volume mesuré prioritaire, inconnus signalés", () => {
  const reference = [ref("canape-3-places", 1, { volume_m3: 2 }), ref("table-basse", 1, { optional: true }), ref("lampe-a-poser", 1, { optional: true })];
  const inRange = scoreCase("s", [det("canape-3-places", 1, { unitVolumeM3: 2.2 })], reference, CATALOG);
  assert.deepEqual([inRange.volume.referenceMinM3, inRange.volume.referenceMaxM3, inRange.volume.errorM3], [2, 2.3, 0]);
  assert.equal(inRange.volume.unknownReferenceVolumes, 1);
  assert.equal(scoreCase("s", [det("canape-3-places", 1, { unitVolumeM3: 1.5 })], reference, CATALOG).volume.errorM3, -0.5);
});

test("cas en échec (aucune analyse) : tout est oublié", () => {
  const s = scoreCase("salon", null, [ref("canape-3-places", 1), ref("table-basse", 1)], CATALOG);
  assert.equal(s.analysed, false);
  assert.equal(s.correct, 0);
  assert.equal(s.missed.length, 2);
});

test("synthèse : rappel, précision, score pondéré, coût et latence", () => {
  const reference = [ref("canape-3-places", 1), ref("table-basse", 1), ref("chaise", 2, { partial: true })];
  const scores = [
    scoreCase("a", [det("canape-3-places", 1), det("table-basse", 1), det("chaise", 2)], reference, CATALOG),
    scoreCase("b", [det("canape-3-places", 1), det("etagere", 1)], reference, CATALOG),
  ];
  const m = summarizeModel("claude-haiku-5-5", scores, [
    { latencyMs: 2000, costUsd: 0.001, ok: true },
    { latencyMs: 4000, costUsd: 0.003, ok: true },
  ]);
  assert.equal(m.correct, 5);
  assert.equal(m.referenceTotal, 8);
  assert.equal(m.recall, 5 / 8);
  assert.equal(m.precision, 5 / 6);
  assert.equal(m.partialRecall, 2 / 4);
  assert.equal(m.difficultRecall, null);
  assert.deepEqual(m.unmeasured, ["difficult"]);
  assert.equal(m.costUsd, 0.004);
  assert.equal(m.costPerCaseUsd, 0.002);
  assert.equal(m.latencyMeanMs, 3000);
  assert.equal(m.latencyMaxMs, 4000);
  // Score : poids du critère non mesuré réparti sur les autres
  const w = QUALITY_WEIGHTS;
  const total = w.objects + w.categories + w.volume + w.partial + w.duplicates;
  const expected = (100 * (w.objects * m.criteria.objects! + w.categories * m.criteria.categories! + w.volume * m.criteria.volume! + w.partial * m.criteria.partial! + w.duplicates * m.criteria.duplicates!)) / total;
  assert.equal(m.qualityScore, Math.round(expected * 10) / 10);
  assert.ok(m.qualityScore > 0 && m.qualityScore < 100);
});

test("suggestion de compromis : le moins cher sans échec à moins de 5 points du meilleur", () => {
  const base = summarizeModel("x", [], []);
  const mk = (model: string, qualityScore: number, costPerCaseUsd: number, failures = 0) => ({ ...base, model, qualityScore, costPerCaseUsd, failures });
  assert.equal(suggestCompromise([mk("opus", 90, 0.08), mk("sonnet", 87, 0.04), mk("haiku", 70, 0.002)])?.model, "sonnet");
  assert.equal(suggestCompromise([mk("opus", 90, 0.08), mk("sonnet", 87, 0.04, 1), mk("haiku", 86, 0.002)])?.model, "haiku");
  assert.equal(suggestCompromise([mk("opus", 90, 0.08, 1)]), null);
  assert.equal(suggestCompromise([]), null);
});
