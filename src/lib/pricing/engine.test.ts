import { test } from "node:test";
import assert from "node:assert/strict";
import { billableVolume, computePrice, type PricingInput } from "./engine.ts";

const settings = {
  price_per_m3: 85,
  minimum_price: 380,
  travel_fee: 50,
  included_distance_km: 50,
  price_per_extra_km: 0.9,
  floor_fee_without_elevator: 22,
  floor_fee_small_elevator: 10,
  free_carrying_distance_m: 10,
  carrying_fee_per_10m: 15,
  heavy_item_fee: 65,
  vat_rate: 20,
};

const base: PricingInput = {
  settings,
  options: [
    { id: "o1", name: "Emballage du fragile", pricing_mode: "per_m3", price: 12 },
    { id: "o2", name: "Garde-meubles (mois)", pricing_mode: "per_item", price: 90 },
    { id: "o3", name: "Démontage", pricing_mode: "fixed", price: 120 },
  ],
  surcharges: [{ name: "Piano droit", surcharge: 250 }],
  selectedOptions: [],
  volumeM3: 18.32,
  distanceKm: 72.3,
  distanceMethod: "route",
  dwellings: [
    { kind: "origin", floor: 3, elevator: "none", carrying_distance_m: 25 },
    { kind: "destination", floor: 2, elevator: "standard", carrying_distance_m: 5 },
  ],
  heavyItems: [],
};

test("volume facturé arrondi au dixième supérieur, sans erreur de virgule flottante", () => {
  assert.equal(billableVolume(18.32), 18.4);
  assert.equal(billableVolume(18.3), 18.3);
  assert.equal(billableVolume(0.1 + 0.2), 0.3);
  assert.equal(billableVolume(0), 0);
});

test("devis complet : lignes, arrondis et TVA", () => {
  const r = computePrice(base);
  assert.equal(r.ok, true);
  if (!r.ok) return;
  const byCode = Object.fromEntries(r.lines.map((l) => [l.code + (l.label.includes("arrivée") ? "-arr" : ""), l.amount_cents]));
  assert.equal(byCode.volume, 156400); // 18,4 × 85 €
  assert.equal(byCode.travel, 5000);
  assert.equal(byCode.distance, 23 * 90); // 73 km - 50 inclus
  assert.equal(byCode.floors, 3 * 2200); // arrivée avec ascenseur standard : rien
  assert.equal(byCode.carrying, 2 * 1500); // 15 m au-delà → 2 tranches
  assert.equal(r.totalHtCents, 156400 + 5000 + 2070 + 6600 + 3000);
  assert.equal(r.vatCents, Math.round(r.totalHtCents * 0.2));
  assert.equal(r.totalTtcCents, r.totalHtCents + r.vatCents);
});

test("forfait minimum appliqué par une ligne d'ajustement explicite", () => {
  const r = computePrice({ ...base, volumeM3: 2, distanceKm: 10, dwellings: [], settings: { ...settings, travel_fee: 0 } });
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.equal(r.totalHtCents, 38000);
  assert.equal(r.lines.at(-1)?.code, "minimum");
  assert.equal(r.lines.at(-1)?.amount_cents, 38000 - 17000);
});

test("objets lourds : supplément spécifique de l'entreprise, sinon supplément par défaut", () => {
  const r = computePrice({
    ...base,
    heavyItems: [
      { name: "Piano droit", catalogName: "Piano droit", quantity: 1 },
      { name: "Réfrigérateur", catalogName: "Réfrigérateur", quantity: 2 },
    ],
  });
  assert.ok(r.ok);
  if (!r.ok) return;
  const heavy = r.lines.filter((l) => l.code === "heavy");
  assert.deepEqual(heavy.map((l) => l.amount_cents), [25000, 2 * 6500]);
});

test("options choisies : forfait, au m³, à l'unité ; option disparue signalée", () => {
  const r = computePrice({
    ...base,
    selectedOptions: [
      { option_id: "o1", quantity: 1 },
      { option_id: "o2", quantity: 3 },
      { option_id: "o3", quantity: 5 },
      { option_id: "inconnue", quantity: 1 },
    ],
  });
  assert.ok(r.ok);
  if (!r.ok) return;
  const options = r.lines.filter((l) => l.code === "option").map((l) => l.amount_cents);
  assert.deepEqual(options, [Math.round(18.4 * 1200), 27000, 12000]);
  assert.ok(r.assumptions.some((a) => a.includes("n'est plus proposée")));
});

test("données manquantes : aucun prix inventé", () => {
  const noVolume = computePrice({ ...base, volumeM3: 0 });
  assert.equal(noVolume.ok, false);
  const noDistance = computePrice({ ...base, distanceKm: null });
  assert.equal(noDistance.ok, false);
  if (!noDistance.ok) assert.ok(noDistance.blockers[0].includes("distance"));
  const noPrice = computePrice({ ...base, settings: { ...settings, price_per_m3: 0 } });
  assert.equal(noPrice.ok, false);
});

test("hypothèses signalées : étage inconnu, distance estimée", () => {
  const r = computePrice({
    ...base,
    distanceMethod: "estimate",
    dwellings: [{ kind: "origin", floor: null, elevator: null, carrying_distance_m: null }],
  });
  assert.ok(r.ok);
  assert.equal(r.assumptions.length, 3);
});

test("calcul déterministe : mêmes entrées, même résultat", () => {
  assert.deepEqual(computePrice(base), computePrice(structuredClone(base)));
});
