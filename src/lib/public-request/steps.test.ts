import { test } from "node:test";
import assert from "node:assert/strict";
import { reachableStep, stepHref } from "./steps.ts";

const base = {
  moving_date: "2027-03-15",
  inventory_method: null,
  customer: null,
  dwellings: { origin: { floor: 0, housing_type: "house" }, destination: { floor: 2, housing_type: "apartment" } },
  rooms: [],
  item_count: 0,
};

test("progression : chaque étape exige la précédente", () => {
  assert.equal(reachableStep(null), 0);
  assert.equal(reachableStep({ ...base, dwellings: { origin: { floor: null, housing_type: "house" }, destination: base.dwellings.destination } }), 0, "étage obligatoire");
  assert.equal(reachableStep(base), 1, "rez-de-chaussée (0) accepté");
  const withContact = { ...base, customer: { privacy_accepted: true, phone: "0612345678" } };
  assert.equal(reachableStep(withContact), 2);
  assert.equal(reachableStep({ ...withContact, inventory_method: "manual" }), 3);
  assert.equal(reachableStep({ ...withContact, inventory_method: "manual", item_count: 2 }), 4);
  assert.equal(reachableStep({ ...withContact, inventory_method: "video", rooms: [{ videos: [] }] }), 3);
  assert.equal(reachableStep({ ...withContact, inventory_method: "video", rooms: [{ videos: [{}] }] }), 4);
});

test("l'étape inventaire mène aux pièces à filmer pour la méthode vidéo", () => {
  assert.equal(stepHref("demo", "inventaire", "video"), "/d/demo/demande/pieces");
  assert.equal(stepHref("demo", "inventaire", "manual"), "/d/demo/demande/inventaire");
  assert.equal(stepHref("demo", "coordonnees"), "/d/demo/demande/coordonnees");
});
