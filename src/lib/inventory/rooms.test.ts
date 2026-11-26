import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { detectedBoxes, displayRooms, nextRoomName, parseQuantityInput, ROOM_TABS, tabFor, tabForCatalogCategory, tabKeyForItem } from "./rooms.ts";
import { FLOOR_Y, SCENE_HEIGHT, SCENE_WIDTH, SCENES } from "./scenes.ts";

const catalog = JSON.parse(readFileSync(new URL("../../../data/catalog/catalog.json", import.meta.url), "utf8")) as { items: { id: string; category: string }[] };
const byId = new Map(catalog.items.map((i) => [i.id, i]));

test("les 8 pièces demandées, dans l'ordre", () => {
  assert.deepEqual(ROOM_TABS.map((t) => t.label), ["Salon", "Cuisine", "Chambre", "Salle de bain", "Bureau", "Entrée / couloir", "Garage / cave", "Autre pièce"]);
});

test("chaque catégorie du catalogue a une pièce (aucune catégorie parallèle)", () => {
  for (const item of catalog.items) assert.ok(ROOM_TABS.some((t) => t.catalog.includes(item.category)), `${item.id} (${item.category}) sans pièce`);
  assert.equal(tabForCatalogCategory("entree"), "entree");
  assert.equal(tabForCatalogCategory("electromenager"), "cuisine");
  assert.equal(tabForCatalogCategory("inconnue"), "autres");
});

test("illustrations : identifiants exacts du catalogue, zones dans le cadre et sans chevauchement", () => {
  for (const [tab, scene] of Object.entries(SCENES)) {
    assert.ok(tabFor(tab), tab);
    assert.ok(scene.objects.length >= 4, `${tab} : au moins 4 objets`);
    scene.objects.forEach((a, i) => {
      assert.ok(byId.has(a.catalogKey), `${tab} : ${a.catalogKey} absent du catalogue`);
      const [x, y, w, h] = a.box;
      assert.ok(x >= 0 && y >= 0 && x + w <= SCENE_WIDTH && y + h <= SCENE_HEIGHT, `${tab} : ${a.catalogKey} hors cadre`);
      assert.ok(w >= 34 && h >= 34, `${tab} : ${a.catalogKey} zone trop petite pour le doigt`);
      for (const b of scene.objects.slice(i + 1)) {
        const [bx, by, bw, bh] = b.box;
        const overlap = x < bx + bw && bx < x + w && y < by + bh && by < y + h;
        assert.ok(!overlap, `${tab} : ${a.catalogKey} chevauche ${b.catalogKey}`);
      }
    });
    assert.ok(scene.objects.some((x) => x.box[1] + x.box[3] === FLOOR_Y), `${tab} : meubles posés au sol`);
  }
});

test("onglets : pièces de base puis pièces supplémentaires", () => {
  const rooms = [
    { id: "r1", name: "Chambre", category: "chambres" },
    { id: "r2", name: "Chambre 2", category: "chambres:2" },
    { id: "r3", name: "Mon logement", category: null },
    { id: "r4", name: "Cartons", category: "cartons" },
  ];
  const display = displayRooms(rooms);
  assert.equal(display.length, 9);
  assert.equal(display.find((d) => d.tabKey === "chambres")?.roomId, "r1");
  assert.deepEqual(display.at(-1), { tabKey: "room:r2", base: "chambres", label: "Chambre 2", roomId: "r2", extra: true });
  const cat = (k: string) => byId.get(k)?.category;
  assert.equal(tabKeyForItem({ room_id: "r2", catalog_key: "lit-simple", category: "chambres" }, rooms, cat, display), "room:r2");
  assert.equal(tabKeyForItem({ room_id: "r3", catalog_key: "refrigerateur", category: "electromenager" }, rooms, cat, display), "cuisine", "objet de l'analyse rangé par catégorie");
  assert.equal(tabKeyForItem({ room_id: "r4", catalog_key: "carton-standard", category: "cartons" }, rooms, cat, display), null, "cartons supplémentaires : étape dédiée");
  assert.equal(nextRoomName(tabFor("chambres")!, ["Chambre", "Chambre 2"]), "Chambre 3");
});

test("cartons déjà repérés par l'analyse", () => {
  assert.equal(detectedBoxes([
    { source: "ai", catalog_key: "carton-standard", quantity: 6 },
    { source: "ai", catalog_key: "lot-10-cartons", quantity: 1 },
    { source: "customer", catalog_key: "carton-standard", quantity: 20 },
    { source: "ai", catalog_key: "lit-double", quantity: 1 },
  ]), 16);
});

test("saisie directe des quantités : entiers positifs seulement, champ vide toléré", () => {
  assert.deepEqual(parseQuantityInput(""), { ok: true, value: null });
  assert.deepEqual(parseQuantityInput(" 12 "), { ok: true, value: 12 });
  assert.deepEqual(parseQuantityInput("0"), { ok: true, value: 0 });
  for (const bad of ["-1", "1,5", "1.5", "abc", "2e3", "+3"]) assert.equal(parseQuantityInput(bad).ok, false, bad);
  assert.equal(parseQuantityInput("1000").ok, false);
});
