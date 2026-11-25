/**
 * Logique pure de la validation client et de la vérification du déménageur.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { compareQuoteTerms, type QuoteTerms } from "./compare.ts";
import { customerQuoteState } from "./customer-state.ts";
import { quoteTrack, verificationTrack, QUOTE_TRACK, VERIFICATION_TRACK } from "../requests/tracks.ts";
import { describeChanges } from "../inventory/changes.ts";
import { buildCorrectionEmail } from "../notifications/inventory-email.ts";
import { CUSTOMER_INVENTORY_WARNING, customerDuplicateExplanation } from "../inventory/duplicates.ts";
import { effectiveDuplicateDecision, summarizeVolume, volumeBucket, type InventoryItem } from "../inventory/volume.ts";

const terms = (ttc: number, extra: Partial<QuoteTerms> = {}): QuoteTerms => ({
  totalTtcCents: ttc, totalHtCents: Math.round(ttc / 1.2), billableM3: 12.4,
  lines: [{ code: "volume", label: "Volume", quantity: 12.4, amount_cents: ttc - 10000 }, { code: "travel", label: "Déplacement", quantity: 1, amount_cents: 10000 }],
  ...extra,
});

test("décisions : le déménageur prime pour le calcul, la réponse du client reste", () => {
  assert.equal(effectiveDuplicateDecision("same", null), "same");
  assert.equal(effectiveDuplicateDecision("same", "distinct"), "distinct");
  assert.equal(effectiveDuplicateDecision(null, null), null);
  assert.equal(effectiveDuplicateDecision("autre", null), null);
});

test("volume : « même meuble » non compté, « autre meuble » compté sans signalement de doublon", () => {
  const ai = (o: Partial<InventoryItem>): InventoryItem => ({ id: "x", name: "Lit", room: "Chambre", quantity: 1, unitVolumeM3: 0.8, source: "ai", confidence: 0.95, ...o });
  const items = [ai({ id: "a" }), ai({ id: "b", possibleDuplicate: true, duplicateDecision: "same" }), ai({ id: "c", possibleDuplicate: true, duplicateDecision: "distinct" })];
  const s = summarizeVolume(items);
  assert.equal(s.estimatedM3, 1.6, "le lit déclaré « même meuble » n'est compté qu'une fois");
  assert.equal(s.possibleDuplicateM3, 0);
  assert.equal(volumeBucket(items[2]), "confirmed", "un autre meuble sûr est confirmé");
  assert.equal(volumeBucket(ai({ possibleDuplicate: true })), "toVerify", "sans réponse : compté, à vérifier");
});

test("comparaison des devis : conditions identiques, ou différences listées", () => {
  assert.deepEqual(compareQuoteTerms(terms(98000), terms(98000)), { identical: true, differences: [] });
  const changed = compareQuoteTerms(terms(98000), terms(104000, { billableM3: 13.2 }));
  assert.equal(changed.identical, false);
  assert.ok(changed.differences.some((d) => /Montant TTC : 980,00 € → 1\s040,00 €/.test(d.replace(/ /g, " "))), changed.differences.join(" | "));
  assert.ok(changed.differences.some((d) => /Volume facturé : 12,4 m³ → 13,2 m³/.test(d)));
  // Même montant (forfait minimum) mais volume facturé différent : condition modifiée.
  assert.equal(compareQuoteTerms(terms(98000), terms(98000, { billableM3: 12.6 })).identical, false);
  // Ligne ajoutée (objet lourd) même à total égal : signalée.
  const extra = terms(98000, { lines: [...terms(98000).lines, { code: "heavy", label: "Objet lourd : piano", quantity: 1, amount_cents: 0 }] });
  assert.ok(compareQuoteTerms(terms(98000), extra).differences.some((d) => /Ligne ajoutée : Objet lourd/.test(d)));
});

test("état des devis côté client : avenant en attente, devis accepté en vigueur, refus", () => {
  const v1 = { id: "1", version: 1, status: "accepted" };
  const v2 = { id: "2", version: 2, status: "sent", amends_quote_id: "1" };
  const s = customerQuoteState([v1, v2]);
  assert.equal(s.inForce?.id, "1");
  assert.equal(s.pending?.id, "2");
  assert.equal(s.current?.id, "2");
  const refused = customerQuoteState([v1, { ...v2, status: "refused" }]);
  assert.equal(refused.inForce?.id, "1", "un avenant refusé laisse le devis accepté en vigueur");
  assert.equal(refused.pending, null);
  assert.equal(refused.current?.id, "1");
  assert.equal(refused.lastRefused?.id, "2");
  const caseA = customerQuoteState([{ id: "1", version: 1, status: "superseded" }, { id: "2", version: 2, status: "sent" }]);
  assert.equal(caseA.current?.id, "2");
  assert.equal(caseA.inForce, null);
});

test("suivis indépendants : devis et vérification", () => {
  assert.equal(quoteTrack("awaiting_customer", [], "succeeded"), "awaiting_customer");
  assert.equal(quoteTrack("customer_validated", [], "succeeded"), "customer_validated");
  assert.equal(quoteTrack("analyzing", [], "running"), "analysis_running");
  assert.equal(quoteTrack("to_review", [], "succeeded"), "analysis_done");
  const v1 = { version: 1, status: "sent", origin: "customer_validation" };
  assert.equal(quoteTrack("quote_sent", [v1], "succeeded"), "quote_sent");
  assert.equal(quoteTrack("accepted", [{ ...v1, status: "accepted" }], "succeeded"), "accepted");
  assert.equal(quoteTrack("refused", [{ ...v1, status: "refused" }], "succeeded"), "refused");
  const v2 = { version: 2, status: "sent", origin: "verification" };
  assert.equal(quoteTrack("accepted", [{ ...v1, status: "accepted" }, v2], "succeeded"), "new_version_sent");
  assert.equal(quoteTrack("accepted", [{ ...v1, status: "accepted" }, { ...v2, status: "accepted" }], "succeeded"), "new_version_accepted");
  assert.equal(quoteTrack("accepted", [{ ...v1, status: "accepted" }, { ...v2, status: "refused" }], "succeeded"), "new_version_refused");
  assert.equal(quoteTrack("quote_sent", [{ ...v1, status: "superseded" }, v2], "succeeded"), "new_version_sent");
  assert.equal(verificationTrack("pending"), "pending");
  assert.equal(verificationTrack("autre"), "not_required");
  // Les 11 statuts demandés existent.
  const labels = [...Object.values(QUOTE_TRACK), ...Object.values(VERIFICATION_TRACK)].map((s) => s.label);
  for (const l of ["Analyse IA terminée", "Inventaire en attente de validation client", "Inventaire validé par le client", "Devis transmis au client", "Devis accepté par le client", "Devis refusé par le client", "Vérification humaine en attente", "Vérifié par le déménageur", "Inventaire corrigé par le déménageur", "Nouvelle version du devis transmise", "Nouvelle version acceptée", "Nouvelle version refusée"]) {
    assert.ok(labels.includes(l), l);
  }
});

test("historique : seules les vraies modifications sont listées (pas les confirmations ni les réponses du client)", () => {
  const changes = describeChanges([
    { action: "customer_decision", actor: "customer", changes: { name: "Lit", decision: "same" }, volume_before_m3: 0.8, volume_after_m3: 0 },
    { action: "confirm", changes: {}, volume_before_m3: 1, volume_after_m3: 1, item_name: "Table" },
    { action: "add", changes: { name: "Piano droit", quantity: 1, unit_volume_m3: 1.5 }, volume_before_m3: 0, volume_after_m3: 1.5 },
    { action: "remove", changes: { removed: { avant: false, apres: true } }, volume_before_m3: 0.3, volume_after_m3: 0, item_name: "Table basse" },
    { action: "update", changes: { quantity: { avant: 1, apres: 2 } }, volume_before_m3: 0.15, volume_after_m3: 0.3, item_name: "Chaise" },
    { action: "duplicate_decision", changes: { name: "Lit simple", decision: "distinct" }, volume_before_m3: 0, volume_after_m3: 0.8 },
  ]);
  assert.deepEqual(changes.map((c) => c.kind), ["added", "removed", "corrected", "added"]);
  assert.match(changes[0].label, /Piano droit/);
  assert.match(changes[2].label, /Chaise \(quantité 1 → 2\)/);
  assert.equal(changes[3].volumeDeltaM3, 0.8);
});

test("e-mail : vérification humaine, meubles, volumes, montants, raison, suite à donner", () => {
  const base = {
    companyName: "Déménagements Martin", customerName: "Lina Martin", reference: "DS-0042",
    changes: describeChanges([{ action: "add", changes: { name: "Piano droit", quantity: 1 }, volume_before_m3: 0, volume_after_m3: 1.5 }]),
    volumeBeforeM3: 12.4, volumeAfterM3: 13.9, totalBeforeCents: 98000, totalAfterCents: 110000, reason: "Piano visible dans l'entrée, absent de l'inventaire.",
  };
  const amendment = buildCorrectionEmail({ ...base, outcome: "corrected_amendment", newVersion: 2 });
  const text = amendment.text.replace(/ /g, " ");
  for (const expected of [/vérification humaine/, /Meubles ajoutés :\n  - Piano droit/, /Volume : 12,4 m³ → 13,9 m³/, /Montant TTC : 980,00 € → 1 100,00 €/, /Raison de la modification : Piano/, /reste valable et inchangé/, /acceptez explicitement/]) {
    assert.match(text, expected);
  }
  assert.match(amendment.subject, /votre devis est modifié/);
  const same = buildCorrectionEmail({ ...base, outcome: "corrected_same_terms", newVersion: null, totalAfterCents: 98000 });
  assert.match(same.text, /vous n'avez rien à faire/);
  assert.match(same.subject, /devis inchangé/);
  assert.match(buildCorrectionEmail({ ...base, outcome: "corrected_new_version", newVersion: 2 }).text, /nouvelle version de votre devis \(version 2\)/);
});

test("client : avertissement exact et explication compréhensible de chaque signalement", () => {
  assert.match(CUSTOMER_INVENTORY_WARNING, /^Merci de vérifier attentivement votre inventaire et de répondre avec honnêteté\./);
  assert.match(CUSTOMER_INVENTORY_WARNING, /modification du volume estimé et du montant de votre devis\.$/);
  const never = customerDuplicateExplanation({ name: "Canapé 3 places", room: "Salon", duplicateOf: { name: "Canapé 3 places", room: "Salon" }, reason: "Même type de meuble (Canapé 3 places) que « Canapé », jamais visibles ensemble…" });
  assert.match(never, /apparaît à un autre moment de votre vidéo/);
  const doubt = customerDuplicateExplanation({ name: "Armoire", room: "Chambre", duplicateOf: { name: "Armoire", room: "Chambre" }, reason: "Doute signalé par l'IA : même poignée, angle différent" });
  assert.match(doubt, /L'analyse hésite.*même poignée, angle différent/);
  const otherRoom = customerDuplicateExplanation({ name: "Réfrigérateur", room: "Salon", duplicateOf: { name: "Réfrigérateur", room: "Cuisine" }, reason: "L'IA pense avoir peut-être vu ce meuble dans une autre pièce : vu par la porte" });
  assert.match(otherRoom, /déjà été filmé dans une autre pièce \(« Réfrigérateur » dans « Cuisine »\).*vu par la porte/);
  assert.match(customerDuplicateExplanation({ name: "Lit", room: "Chambre", duplicateOf: null, reason: null }), /ressemble peut-être/);
});
