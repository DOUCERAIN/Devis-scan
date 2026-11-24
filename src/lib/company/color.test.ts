import { test } from "node:test";
import assert from "node:assert/strict";
import { accessibleBrandColor, brandCssVariables, contrastWithWhite } from "./color.ts";

test("le bleu Devis Scan est déjà lisible avec du texte blanc", () => {
  assert.ok(contrastWithWhite("#3050c8") >= 4.5);
  assert.equal(accessibleBrandColor("#3050c8"), "#3050c8");
});

test("une couleur trop claire est assombrie jusqu'au contraste requis", () => {
  const yellow = "#f5d000";
  assert.ok(contrastWithWhite(yellow) < 4.5);
  const fixed = accessibleBrandColor(yellow);
  assert.ok(contrastWithWhite(fixed) >= 4.5, `${fixed} devrait être lisible`);
});

test("variables de marque blanche : aucune pour une valeur invalide", () => {
  assert.equal(brandCssVariables(null), undefined);
  assert.equal(brandCssVariables("rouge"), undefined);
  const vars = brandCssVariables("#1f6e55");
  assert.ok(vars && vars["--ds-brand"] === "#1f6e55");
});
