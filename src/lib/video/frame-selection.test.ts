import { test } from "node:test";
import assert from "node:assert/strict";
import { laplacianVariance, sampleTimestamps, selectFrames, signatureDistance, targetDimensions, type FrameCandidate } from "./frame-selection.ts";

const sig = (v: number) => new Uint8Array(64).fill(v);
const cand = (time: number, sharpness: number, level: number, brightness = 120): FrameCandidate => ({ time, sharpness, signature: sig(level), brightness });

test("échantillonnage réparti sur la durée", () => {
  const t = sampleTimestamps(30, 24);
  assert.equal(t.length, 24);
  assert.ok(t[0] > 0 && t[t.length - 1] < 30);
  assert.deepEqual(sampleTimestamps(0.5), [0.25]);
  assert.deepEqual(sampleTimestamps(Number.NaN), [0]);
  assert.equal(sampleTimestamps(2, 24).length, 8);
});

test("les images floues et quasi identiques sont écartées", () => {
  const frames = [
    cand(1, 500, 10), cand(2, 480, 12), // presque identiques : une seule retenue
    cand(3, 20, 100), // floue
    cand(4, 400, 140), cand(5, 450, 200),
    cand(6, 600, 60, 5), // noire
  ];
  const chosen = selectFrames(frames, { max: 8 });
  assert.deepEqual(chosen.map((c) => c.time), [1, 4, 5]);
});

test("nombre maximal respecté et ordre chronologique", () => {
  const frames = Array.from({ length: 20 }, (_, i) => cand(i, 100 + i, i * 12));
  const chosen = selectFrames(frames, { max: 5 });
  assert.equal(chosen.length, 5);
  assert.deepEqual([...chosen].sort((a, b) => a.time - b.time), chosen);
});

test("toujours au moins une image si la vidéo n'est pas vide", () => {
  assert.equal(selectFrames([cand(1, 10, 0, 2)]).length, 1);
  assert.equal(selectFrames([]).length, 0);
});

test("mesures de netteté et de différence", () => {
  const flat = new Uint8Array(100).fill(128);
  const checker = Uint8Array.from({ length: 100 }, (_, i) => ((i + Math.floor(i / 10)) % 2 ? 255 : 0));
  assert.equal(laplacianVariance(flat, 10, 10), 0);
  assert.ok(laplacianVariance(checker, 10, 10) > 1000);
  assert.equal(signatureDistance(sig(10), sig(30)), 20);
});

test("dimensions cibles 720p (paysage, portrait, petite vidéo)", () => {
  assert.deepEqual(targetDimensions(1920, 1080), { width: 1280, height: 720, scaled: true });
  assert.deepEqual(targetDimensions(1080, 1920), { width: 720, height: 1280, scaled: true });
  assert.deepEqual(targetDimensions(640, 480), { width: 640, height: 480, scaled: false });
  assert.deepEqual(targetDimensions(3840, 2160).height, 720);
});
