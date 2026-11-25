import { test } from "node:test";
import assert from "node:assert/strict";
import { summarizeVolume, volumeBucket, formatVolume, type InventoryItem } from "./volume.ts";
import { confidenceLevel, formatScore } from "./confidence.ts";

const ai = (over: Partial<InventoryItem>): InventoryItem => ({
  id: "x", name: "Meuble", room: "Salon", quantity: 1, unitVolumeM3: 1, source: "ai", confidence: 0.9, ...over,
});

test("niveaux de confiance aux seuils validés", () => {
  assert.equal(confidenceLevel(0.85), "sure");
  assert.equal(confidenceLevel(0.849), "verify");
  assert.equal(confidenceLevel(0.6), "verify");
  assert.equal(confidenceLevel(0.59), "uncertain");
  assert.equal(confidenceLevel(Number.NaN), "uncertain");
});

test("un meuble incertain n'est pas compté dans le volume estimé", () => {
  const s = summarizeVolume([ai({ confidence: 0.95, unitVolumeM3: 1.4 }), ai({ confidence: 0.4, unitVolumeM3: 0.8 })]);
  assert.equal(s.confirmedM3, 1.4);
  assert.equal(s.potentialM3, 0.8);
  assert.equal(s.estimatedM3, 1.4);
  assert.equal(s.maxM3, 2.2);
  assert.equal(s.needsHumanReview, true);
  assert.equal(s.itemsToReview, 1);
});

test("les éléments à vérifier comptent dans l'estimation mais demandent une vérification", () => {
  const s = summarizeVolume([ai({ confidence: 0.7, unitVolumeM3: 1.6 })]);
  assert.equal(s.confirmedM3, 0);
  assert.equal(s.toVerifyM3, 1.6);
  assert.equal(s.estimatedM3, 1.6);
  assert.equal(s.maxM3, 1.6);
  assert.equal(s.needsHumanReview, true);
});

test("un doublon possible reste compté « à vérifier », même avec un bon score (jamais retiré automatiquement)", () => {
  assert.equal(volumeBucket(ai({ confidence: 0.97, possibleDuplicate: true })), "toVerify");
  assert.equal(volumeBucket(ai({ confidence: 0.7, possibleDuplicate: true })), "toVerify");
  // Un objet incertain reste potentiel, doublon ou non.
  assert.equal(volumeBucket(ai({ confidence: 0.3, possibleDuplicate: true })), "potential");
  const s = summarizeVolume([ai({ unitVolumeM3: 1.5, confidence: 0.95 }), ai({ unitVolumeM3: 1.5, confidence: 0.95, possibleDuplicate: true })]);
  assert.equal(s.estimatedM3, 3);
  assert.equal(s.possibleDuplicateM3, 1.5);
  assert.equal(s.itemsToReview, 1);
  assert.equal(s.needsHumanReview, true);
});

test("une validation humaine l'emporte sur le score de l'IA", () => {
  assert.equal(volumeBucket(ai({ confidence: 0.2, validatedByHuman: true })), "confirmed");
  assert.equal(volumeBucket(ai({ confidence: 0.2, possibleDuplicate: true, validatedByHuman: true })), "confirmed");
  assert.equal(volumeBucket({ ...ai({}), source: "manual", confidence: undefined }), "confirmed");
});

test("quantités, éléments retirés et arrondis", () => {
  const s = summarizeVolume([
    ai({ quantity: 4, unitVolumeM3: 0.15 }),
    ai({ removed: true, unitVolumeM3: 5 }),
    ai({ quantity: 0, unitVolumeM3: 3, confidence: 0.1 }),
  ]);
  assert.equal(s.confirmedM3, 0.6);
  assert.equal(s.maxM3, 0.6);
  assert.equal(s.needsHumanReview, false);
});

test("inventaire vide", () => {
  const s = summarizeVolume([]);
  assert.deepEqual([s.estimatedM3, s.maxM3, s.needsHumanReview], [0, 0, false]);
});

test("formats français", () => {
  assert.equal(formatVolume(18.4), "18,4 m³");
  assert.equal(formatScore(0.684), "68 %");
});
