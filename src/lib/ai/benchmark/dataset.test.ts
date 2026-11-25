import { test } from "node:test";
import assert from "node:assert/strict";
import { caseSchema, coverage, readImageInfo, validateCase, type FrameInfo } from "./dataset.ts";
import { renderDetailsCsv, renderMarkdown, renderSummaryCsv } from "./report.ts";
import { scoreCase, summarizeModel } from "./score.ts";

const base = {
  id: "salon-test",
  room_label: "Salon",
  room_type: "salon",
  situations: ["partiellement-visible"],
  source: { kind: "video-reelle", description: "Vidéo filmée par le porteur du projet", author: "Porteur du projet", license: "usage interne", consent: "occupant (accord écrit du 01/12/2026)" },
  frames: [{ file: "00.jpg" }, { file: "01.jpg" }],
  reference: {
    status: "provisoire",
    annotated_by: "Test",
    annotated_at: "2026-11-25",
    items: [{ key: "canape-3-places", quantity: 1, partial: true, views: ["00.jpg"] }],
  },
};
const frames = (files: string[]) => new Map<string, FrameInfo | null>(files.map((f) => [f, { file: f, width: 1280, height: 720, mediaType: "image/jpeg" }]));
const catalogIds = new Set(["canape-3-places", "table-basse"]);

test("cas valide : valeurs par défaut appliquées, aucun problème", () => {
  const c = caseSchema.parse(base);
  assert.equal(c.reference.items[0].optional, false);
  assert.deepEqual(validateCase(c, { catalogIds, frames: frames(["00.jpg", "01.jpg"]) }), []);
});

test("problèmes détectés : catalogue, image absente, vue inconnue, validation non signée, situation sans objet marqué", () => {
  const c = caseSchema.parse({
    ...base,
    situations: ["partiellement-visible", "objets-ambigus"],
    reference: { ...base.reference, status: "validee", items: [{ key: "canape-inexistant", quantity: 1, views: ["09.jpg"] }] },
  });
  const problems = validateCase(c, { catalogIds, frames: frames(["00.jpg"]) });
  for (const expected of [/catalogue : canape-inexistant/, /absente ou illisible : 01\.jpg/, /vue inconnue/, /sans nom ni date/, /partiellement-visible/, /objets-ambigus/]) {
    assert.ok(problems.some((p) => expected.test(p)), `${expected} dans ${problems.join(" | ")}`);
  }
});

test("schéma : formats refusés", () => {
  assert.throws(() => caseSchema.parse({ ...base, id: "Salon Test" }));
  assert.throws(() => caseSchema.parse({ ...base, frames: [{ file: "video.mp4" }] }));
  assert.throws(() => caseSchema.parse({ ...base, room_type: "grenier" }));
  assert.throws(() => caseSchema.parse({ ...base, frames: Array.from({ length: 21 }, (_, i) => ({ file: `${i}.jpg` })) }));
});

test("lecture des dimensions JPEG et PNG dans l'en-tête", () => {
  // JPEG minimal : SOI, APP0 (longueur 4), SOF0 (hauteur 720, largeur 1280)
  const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0x00, 0x00, 0xff, 0xc0, 0x00, 0x11, 0x08, 0x02, 0xd0, 0x05, 0x00, 0x03, 0, 0, 0, 0, 0, 0]);
  assert.deepEqual(readImageInfo("a.jpg", jpeg), { file: "a.jpg", width: 1280, height: 720, mediaType: "image/jpeg" });
  const png = new Uint8Array(32);
  png.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52, 0, 0, 0x03, 0x20, 0, 0, 0x02, 0x58]);
  assert.deepEqual(readImageInfo("b.png", png), { file: "b.png", width: 800, height: 600, mediaType: "image/png" });
  assert.equal(readImageInfo("c.txt", new Uint8Array([1, 2, 3, 4])), null);
});

test("couverture : un panoramique sur une photo ne compte pas comme « plusieurs angles »", () => {
  const pano = caseSchema.parse({ ...base, situations: ["multi-angles"], source: { ...base.source, kind: "photo-panoramique" } });
  const video = caseSchema.parse({ ...base, situations: ["multi-angles"] });
  const cov = coverage([pano, video]);
  assert.equal(cov.lines.find((l) => l.key === "multi-angles")?.have, 1);
  assert.equal(cov.lines.find((l) => l.key === "salon")?.have, 2);
  assert.equal(cov.lines.find((l) => l.key === "validees")?.ok, false);
  assert.equal(cov.representative, false);
});

test("rapport : Markdown et CSV au format français, avertissements affichés", () => {
  const catalog = new Map([["canape-3-places", { subcategory: "Canapés", movingVolumeAvg: 1.5 }]]);
  const c = caseSchema.parse(base);
  const score = scoreCase(c.id, [{ catalogKey: "canape-3-places", name: "Canapé", quantity: 1, possibleDuplicate: false, unitVolumeM3: 1.5, volumeSource: "catalog" }], c.reference.items, catalog);
  const call = { caseId: c.id, model: "claude-haiku-5-5", pass: 1, servedModel: "claude-haiku-5-5", ok: true, code: null, latencyMs: 2500, usage: { inputTokens: 10, outputTokens: 5, cacheReadTokens: 0, cacheWriteTokens: 0 }, costUsd: 0.0000047 };
  const summary = summarizeModel("claude-haiku-5-5", [score], [call]);
  const md = renderMarkdown({
    title: "Comparaison test", generatedAt: new Date("2026-11-25T10:00:00Z"), runId: "r1", status: "complet", stopReason: null,
    config: { effort: "medium", maxOutputTokens: 7000, repeat: 1, perModelCapUsd: 0.75, campaignCapUsd: 5, roomsPerRequest: 6, pricesCheckedAt: "2026-11-25" },
    models: ["claude-haiku-5-5"], cases: [{ id: c.id, roomLabel: "Salon", roomType: "salon", situations: c.situations, frames: 2, referenceStatus: "provisoire" }],
    coverage: coverage([c]), summaries: [summary], caseScores: [{ model: "claude-haiku-5-5", pass: 1, score }], calls: [call],
    budget: { runCountedUsd: 0.0000047, campaignCountedUsd: 0.0000047, campaignCapUsd: 5 },
  });
  assert.match(md, /Référence non validée/);
  assert.match(md, /Jeu de données non représentatif/);
  assert.match(md, /\| Claude Haiku 5\.5 \| /);
  assert.match(md, /0,0000047 \$/);
  assert.doesNotMatch(md, /\| 0 \$ \|/);
  const csv = renderSummaryCsv([summary], 6);
  assert.ok(csv.startsWith("﻿modele;score_qualite"));
  assert.match(csv, /claude-haiku-5-5;/);
  assert.match(renderDetailsCsv([{ model: "claude-haiku-5-5", pass: 1, score }], [call]), /salon-test;claude-haiku-5-5;1;ok;1;1;aucun/);
});
