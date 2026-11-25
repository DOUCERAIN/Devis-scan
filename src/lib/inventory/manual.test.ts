import { test } from "node:test";
import assert from "node:assert/strict";
import { catalogForCategory, manualCategoryFor, MANUAL_CATEGORIES, normalize, searchCatalog, type CatalogChoice } from "./manual.ts";

const items: CatalogChoice[] = [
  { id: "canape-3-places", name: "Canapé 3 places", category: "salon", synonyms: ["sofa"], volume: 1.5 },
  { id: "chaise", name: "Chaise", category: "cuisine", synonyms: [], volume: 0.15 },
  { id: "chaise-de-bureau", name: "Chaise de bureau", category: "bureau", synonyms: [], volume: 0.3 },
  { id: "refrigerateur", name: "Réfrigérateur", category: "electromenager", synonyms: ["frigo"], volume: null },
  { id: "velo", name: "Vélo", category: "sport_loisirs", synonyms: [], volume: 0.5 },
  { id: "carton-standard", name: "Carton standard", category: "cartons", synonyms: [], volume: 0.1 },
];

test("les sept catégories demandées, dans l'ordre", () => {
  assert.deepEqual(MANUAL_CATEGORIES.map((c) => c.label), ["Salon", "Chambres", "Cuisine", "Salle de bain", "Bureau", "Garage et cave", "Autres espaces"]);
});

test("chaque catégorie du catalogue est rangée dans une catégorie affichée", () => {
  assert.equal(manualCategoryFor("electromenager"), "cuisine");
  assert.equal(manualCategoryFor("sport_loisirs"), "garage_cave");
  assert.equal(manualCategoryFor("cartons"), "autres");
  assert.equal(manualCategoryFor("inconnue"), "autres");
});

test("recherche sans accents, par synonyme, nom exact en premier", () => {
  assert.equal(normalize("Réfrigérateur !"), "refrigerateur");
  assert.deepEqual(searchCatalog(items, "frigo").map((i) => i.id), ["refrigerateur"]);
  assert.deepEqual(searchCatalog(items, "chaise").map((i) => i.id), ["chaise", "chaise-de-bureau"]);
  assert.deepEqual(searchCatalog(items, "  "), []);
  assert.deepEqual(searchCatalog(items, "chaise piano"), []);
});

test("objets d'une catégorie", () => {
  assert.deepEqual(catalogForCategory(items, "cuisine").map((i) => i.id), ["chaise", "refrigerateur"]);
  assert.deepEqual(catalogForCategory(items, "garage_cave").map((i) => i.id), ["velo"]);
});
