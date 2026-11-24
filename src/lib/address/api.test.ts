import { test } from "node:test";
import assert from "node:assert/strict";
import { addressSearchUrl, parseAddressResponse } from "./api.ts";

test("URL de recherche d'adresse", () => {
  const url = new URL(addressSearchUrl("8 bd du port"));
  assert.equal(url.searchParams.get("q"), "8 bd du port");
  assert.equal(url.searchParams.get("autocomplete"), "1");
});

test("lecture de la réponse GeoJSON de l'API Adresse", () => {
  const sample = {
    type: "FeatureCollection",
    features: [
      { type: "Feature", geometry: { type: "Point", coordinates: [2.0706, 49.0368] },
        properties: { label: "8 Boulevard du Port 95000 Cergy", name: "8 Boulevard du Port", postcode: "95000", city: "Cergy", type: "housenumber" } },
      { type: "Feature", properties: { label: "" } },
    ],
  };
  const [s, ...rest] = parseAddressResponse(sample);
  assert.equal(rest.length, 0);
  assert.equal(s.street, "8 Boulevard du Port");
  assert.equal(s.postalCode, "95000");
  assert.equal(s.latitude, 49.0368);
  assert.deepEqual(parseAddressResponse(null), []);
});
