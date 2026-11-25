import { test } from "node:test";
import assert from "node:assert/strict";
import { BudgetGuard, CAMPAIGN_HARD_CAP_USD, checkPlan, countedUsd, DEFAULT_PER_MODEL_CAP_USD, newLedger } from "./budget.ts";
import { imageTokens, worstCaseCallCostUsd, worstCaseInputTokens } from "./tokens.ts";
import { estimateCostUsd, emptyUsage } from "../cost.ts";
import { resolveModels } from "./models.ts";

const guard = (opts: Partial<{ perModelCapUsd: number; campaignCapUsd: number }> = {}) => new BudgetGuard({ ledger: newLedger("test"), runId: "run-1", ...opts });

test("plafonds par défaut : 0,75 $ par modèle, 5 $ pour la campagne, jamais au-delà de 5 $", () => {
  assert.equal(DEFAULT_PER_MODEL_CAP_USD, 0.75);
  assert.equal(CAMPAIGN_HARD_CAP_USD, 5);
  const g = guard({ campaignCapUsd: 50, perModelCapUsd: 20 });
  assert.equal(g.campaignCapUsd, 5);
  assert.equal(g.perModelCapUsd, 5);
  assert.throws(() => guard({ perModelCapUsd: 0 }));
});

test("réservation au pire cas avant l'appel, remplacée par le coût réel après", () => {
  const g = guard();
  const e = g.reserve("claude-opus-5-5", "salon", 0.25);
  assert.equal(g.modelSpentUsd("claude-opus-5-5"), 0.25);
  g.settle(e, { ...emptyUsage(), inputTokens: 10_000, outputTokens: 1_000 }, 0.06);
  assert.equal(g.modelSpentUsd("claude-opus-5-5"), 0.06);
  assert.equal(g.campaignSpentUsd(), 0.06);
});

test("échec sans jetons renvoyés : la réservation maximale reste comptée", () => {
  const g = guard();
  const e = g.reserve("claude-sonnet-5-5", "salon", 0.12);
  g.markUnknown(e, "délai dépassé");
  assert.equal(countedUsd(e), 0.12);
  assert.equal(g.campaignSpentUsd(), 0.12);
});

test("aucun appel ne part s'il pourrait dépasser le plafond du modèle", () => {
  const g = guard();
  g.settle(g.reserve("claude-opus-5-5", "a", 0.3), emptyUsage(), 0.3);
  g.settle(g.reserve("claude-opus-5-5", "b", 0.3), emptyUsage(), 0.3);
  assert.equal(g.check("claude-opus-5-5", 0.15).ok, true); // 0,60 + 0,15 = 0,75 : tout juste
  assert.equal(g.check("claude-opus-5-5", 0.16).ok, false);
  assert.throws(() => g.reserve("claude-opus-5-5", "c", 0.16), /plafond par modèle/);
  assert.equal(g.ledger.entries.length, 2, "aucune réservation créée en cas de refus");
  assert.equal(g.check("claude-haiku-5-5", 0.16).ok, true, "les autres modèles ont leur propre plafond");
});

test("plafond de campagne : les passages précédents (registre) sont comptés", () => {
  const ledger = newLedger("test");
  const old = new BudgetGuard({ ledger, runId: "ancien", perModelCapUsd: 5 });
  old.settle(old.reserve("claude-opus-5-5", "x", 4.8), emptyUsage(), 4.8);
  const g = new BudgetGuard({ ledger, runId: "nouveau" });
  assert.equal(g.modelSpentUsd("claude-opus-5-5"), 0, "plafond par modèle remis à zéro à chaque passage");
  assert.equal(g.campaignRemainingUsd(), 0.2);
  assert.equal(g.check("claude-haiku-5-5", 0.21).ok, false);
  assert.match((g.check("claude-haiku-5-5", 0.21) as { reason: string }).reason, /campagne/);
});

test("vérification préalable du plan complet (pire cas)", () => {
  const g = guard();
  const plan = ["a", "b", "c"].flatMap((caseId) => [
    { model: "claude-haiku-5-5", caseId, worstCaseUsd: 0.01 },
    { model: "claude-opus-5-5", caseId, worstCaseUsd: 0.26 },
  ]);
  const v = checkPlan(g, plan);
  assert.equal(v.ok, false);
  assert.equal(v.perModel.find((m) => m.model === "claude-opus-5-5")?.worstCaseUsd, 0.78);
  assert.match(v.reasons[0], /claude-opus-5-5/);
  assert.equal(checkPlan(g, plan.filter((p) => p.caseId !== "c")).ok, true);
});

test("jetons d'image : ⌈largeur/28⌉ × ⌈hauteur/28⌉, redimensionnement au-delà de 2 576 px", () => {
  assert.equal(imageTokens(1280, 720), 46 * 26);
  assert.equal(imageTokens(28, 28), 1);
  assert.ok(imageTokens(8000, 6000) <= 4784);
  assert.throws(() => imageTokens(0, 10));
});

test("le pire cas majore toujours le coût réel d'un appel de même forme", () => {
  const shape = { images: Array(8).fill({ width: 1280, height: 720 }), textChars: 12_000, maxOutputTokens: 7000 };
  const input = worstCaseInputTokens(shape);
  assert.ok(input > 8 * 1196 + 12_000 / 4, "majoration de l'entrée");
  for (const model of ["claude-haiku-5-5", "claude-sonnet-5-5", "claude-opus-5-5"]) {
    const worst = worstCaseCallCostUsd(model, shape);
    // Appel réel plausible le plus coûteux : toute l'entrée écrite en cache, sortie au plafond.
    const real = estimateCostUsd(model, { inputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 8 * 1196 + 4000, outputTokens: 7000 }) as number;
    assert.ok(worst >= real, `${model} : ${worst} >= ${real}`);
  }
  // Opus 5.5 : ≈ 0,234 $ par pièce de 8 images → 3 pièces tiennent dans 0,75 $
  assert.ok(worstCaseCallCostUsd("claude-opus-5-5", shape) * 3 <= 0.75);
  assert.throws(() => worstCaseCallCostUsd("modele-inconnu", shape));
});

test("Haiku 5.5 : le pire cas bascule au tarif supérieur si l'entrée peut dépasser 100 000 jetons", () => {
  const big = { images: Array(20).fill({ width: 2576, height: 2576 }), textChars: 12_000, maxOutputTokens: 7000 };
  assert.ok(worstCaseInputTokens(big) > 100_000);
  const cost = worstCaseCallCostUsd("claude-haiku-5-5", big);
  assert.ok(cost >= (worstCaseInputTokens(big) * 0.625 + 7000 * 2.5) / 1e6 - 1e-9);
});

test("modèles : uniquement Haiku, Sonnet et Opus 5.5, identifiants exacts", () => {
  assert.deepEqual(resolveModels("haiku,sonnet,opus"), ["claude-haiku-5-5", "claude-sonnet-5-5", "claude-opus-5-5"]);
  assert.deepEqual(resolveModels("claude-opus-5-5, haiku, opus"), ["claude-opus-5-5", "claude-haiku-5-5"]);
  assert.throws(() => resolveModels("claude-opus-5"), /non prévu/);
  assert.throws(() => resolveModels(""), /Aucun modèle/);
});
