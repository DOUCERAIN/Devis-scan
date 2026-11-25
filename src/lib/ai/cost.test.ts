import { test } from "node:test";
import assert from "node:assert/strict";
import { addUsage, COST_DECIMALS, emptyUsage, estimateCostUsd, formatCostUsd, MODEL_PRICES_USD, type TokenUsage } from "./cost.ts";

const usage = (u: Partial<TokenUsage>): TokenUsage => ({ ...emptyUsage(), ...u });
// Espaces utilisées par le format français (espace fine insécable pour les milliers) ramenées à une espace simple.
const plain = (s: string) => s.replace(/[  ]/g, " ");

test("coût très faible : l'appel de test réel (27 + 4 jetons sur Haiku 5.5) n'est plus arrondi à zéro", () => {
  const cost = estimateCostUsd("claude-haiku-5-5", usage({ inputTokens: 27, outputTokens: 4 }));
  // 27 × 0,10 / 1 M + 4 × 0,50 / 1 M = 0,0000027 + 0,0000020
  assert.equal(cost, 0.0000047);
  assert.equal(formatCostUsd(cost), "0,0000047 $");
});

test("coût minimal possible (1 jeton lu en cache sur Haiku 5.5) : positif et affiché", () => {
  const cost = estimateCostUsd("claude-haiku-5-5", usage({ cacheReadTokens: 1 }));
  assert.equal(cost, 0.00000001);
  assert.ok(cost !== null && cost > 0);
  assert.equal(formatCostUsd(cost), "0,00000001 $");
});

test("un seul jeton, sur chaque modèle, donne toujours un coût positif affiché autrement que 0 $", () => {
  for (const model of Object.keys(MODEL_PRICES_USD)) {
    for (const u of [{ inputTokens: 1 }, { outputTokens: 1 }, { cacheReadTokens: 1 }, { cacheWriteTokens: 1 }]) {
      const cost = estimateCostUsd(model, usage(u));
      assert.ok(cost !== null && cost > 0, `${model} ${JSON.stringify(u)}`);
      assert.notEqual(formatCostUsd(cost), "0 $");
      assert.match(formatCostUsd(cost), /[1-9]/);
    }
  }
});

test("coûts plus élevés : calculs exacts sur les tarifs publics", () => {
  // Opus 5.5 : 1 M en entrée × 4 $ + 1 M en sortie × 20 $
  assert.equal(estimateCostUsd("claude-opus-5-5", usage({ inputTokens: 1_000_000, outputTokens: 1_000_000 })), 24);
  // Sonnet 5.5 : 12 345 × 2 $ + 2 345 × 10 $ (par million) = 0,02469 + 0,02345
  assert.equal(estimateCostUsd("claude-sonnet-5-5", usage({ inputTokens: 12_345, outputTokens: 2_345 })), 0.04814);
  // Analyse typique d'une pièce sur Haiku 5.5 : 8 000 jetons d'images en entrée, 1 500 en sortie
  assert.equal(estimateCostUsd("claude-haiku-5-5", usage({ inputTokens: 8_000, outputTokens: 1_500 })), 0.00155);
  // Gros volume : 50 M en entrée et 5 M en sortie sur Opus 5.5 = 200 + 100
  assert.equal(estimateCostUsd("claude-opus-5-5", usage({ inputTokens: 50_000_000, outputTokens: 5_000_000 })), 300);
});

test("cache : lecture à 0,1 × et écriture à 1,25 × le prix d'entrée", () => {
  // Sonnet 5.5 : 10 000 lus (= 1 000 jetons plein tarif) + 1 000 écrits (= 1 250) → 2 250 × 2 $ / 1 M
  assert.equal(estimateCostUsd("claude-sonnet-5-5", usage({ cacheReadTokens: 10_000, cacheWriteTokens: 1_000 })), 0.0045);
  assert.equal(
    estimateCostUsd("claude-opus-5-5", usage({ inputTokens: 1_000, outputTokens: 500, cacheReadTokens: 20_000, cacheWriteTokens: 4_000 })),
    (1_000 * 4 + 500 * 20 + 20_000 * 0.1 * 4 + 4_000 * 1.25 * 4) / 1_000_000,
  );
});

test("aucun jeton : coût nul ; modèle inconnu : null (aucun coût inventé)", () => {
  assert.equal(estimateCostUsd("claude-haiku-5-5", emptyUsage()), 0);
  assert.equal(formatCostUsd(0), "0 $");
  assert.equal(estimateCostUsd("modele-inconnu", usage({ inputTokens: 1_000 })), null);
  assert.equal(formatCostUsd(null), "coût inconnu");
  assert.equal(formatCostUsd(undefined), "coût inconnu");
  assert.equal(formatCostUsd(Number.NaN), "coût inconnu");
  assert.equal(formatCostUsd(-1), "coût inconnu");
});

test("le calcul efface le bruit des nombres à virgule sans perdre de précision", () => {
  const cost = estimateCostUsd("claude-haiku-5-5", usage({ inputTokens: 3, outputTokens: 7 }));
  assert.equal(cost, 0.0000038); // et non 0.0000038000000000000004
  assert.ok(String(cost).length <= 2 + COST_DECIMALS + 4);
});

test("affichage : 3 chiffres significatifs sous 1 $, 2 décimales au-delà, format français", () => {
  assert.equal(formatCostUsd(0.000123456), "0,000123 $");
  assert.equal(formatCostUsd(0.0215), "0,0215 $");
  assert.equal(formatCostUsd(0.5), "0,5 $");
  assert.equal(formatCostUsd(0.04814), "0,0481 $");
  assert.equal(formatCostUsd(1), "1 $");
  assert.equal(formatCostUsd(12.3456), "12,35 $");
  assert.equal(plain(formatCostUsd(1640.5)), "1 640,5 $");
});

test("addUsage additionne chaque catégorie de jetons", () => {
  const total = addUsage(usage({ inputTokens: 1, outputTokens: 2, cacheReadTokens: 3, cacheWriteTokens: 4 }), usage({ inputTokens: 10, outputTokens: 20, cacheReadTokens: 30, cacheWriteTokens: 40 }));
  assert.deepEqual(total, { inputTokens: 11, outputTokens: 22, cacheReadTokens: 33, cacheWriteTokens: 44 });
});
