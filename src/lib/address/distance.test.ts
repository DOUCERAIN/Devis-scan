import { test } from "node:test";
import assert from "node:assert/strict";
import { distanceBetween, haversineKm } from "./distance.ts";

const paris = { latitude: 48.8566, longitude: 2.3522 };
const lyon = { latitude: 45.764, longitude: 4.8357 };

test("distance à vol d'oiseau Paris–Lyon ≈ 392 km", () => {
  assert.ok(Math.abs(haversineKm(paris, lyon) - 392) < 3);
});

test("itinéraire routier utilisé quand le service répond", async () => {
  const fake = (async () => new Response(JSON.stringify({ distance: 465.27 }))) as typeof fetch;
  assert.deepEqual(await distanceBetween(paris, lyon, fake), { km: 465.3, method: "route" });
});

test("repli signalé comme estimation si le service échoue ou répond mal", async () => {
  const down = (async () => {
    throw new Error("réseau");
  }) as typeof fetch;
  const r = await distanceBetween(paris, lyon, down);
  assert.equal(r?.method, "estimate");
  const garbage = (async () => new Response(JSON.stringify({ distance: "?" }))) as typeof fetch;
  assert.equal((await distanceBetween(paris, lyon, garbage))?.method, "estimate");
});

test("coordonnées absentes : pas de distance inventée", async () => {
  assert.equal(await distanceBetween(null, lyon), null);
});
