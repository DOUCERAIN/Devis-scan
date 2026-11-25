import { test } from "node:test";
import assert from "node:assert/strict";
import { formalQuoteEligibility, type EligibilityInput } from "./eligibility.ts";

const ideal: EligibilityInput = {
  autoFormalEnabled: true,
  legalIdentity: true,
  pricingConfigured: true,
  simulated: false,
  failedRooms: 0,
  roomsWithoutImages: 0,
  itemsToReview: 0,
  potentialM3: 0,
  unknownVolumeItems: 0,
  pricingAssumptions: [],
};

test("toutes les conditions réunies et option activée : devis formel automatique", () => {
  assert.deepEqual(formalQuoteEligibility(ideal), { formal: true, reasons: [] });
});

test("option non activée : estimation, même si tout est fiable", () => {
  const r = formalQuoteEligibility({ ...ideal, autoFormalEnabled: false });
  assert.equal(r.formal, false);
  assert.equal(r.reasons.length, 1);
});

test("chaque doute impose une validation humaine, avec son motif", () => {
  const cases: [Partial<EligibilityInput>, RegExp][] = [
    [{ simulated: true }, /simulateur/],
    [{ legalIdentity: false }, /SIRET/],
    [{ pricingConfigured: false }, /Grille/],
    [{ failedRooms: 1 }, /non analysée/],
    [{ roomsWithoutImages: 2 }, /sans vidéo/],
    [{ itemsToReview: 3 }, /3 objets à vérifier/],
    [{ potentialM3: 0.4 }, /incertains/],
    [{ unknownVolumeItems: 1 }, /sans volume/],
    [{ pricingAssumptions: ["Distance estimée"] }, /Distance estimée/],
  ];
  for (const [patch, expected] of cases) {
    const r = formalQuoteEligibility({ ...ideal, ...patch });
    assert.equal(r.formal, false, JSON.stringify(patch));
    assert.match(r.reasons.join(" "), expected);
  }
});
