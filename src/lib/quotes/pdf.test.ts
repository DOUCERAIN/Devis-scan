import { test } from "node:test";
import assert from "node:assert/strict";
import { pdfSafe, renderQuotePdf } from "./pdf.ts";

test("texte compatible avec les polices PDF standard", () => {
  assert.equal(pdfSafe("1 640,00 € · 18,4 m³ ≥"), "1 640,00 € · 18,4 m³ >=");
  assert.equal(pdfSafe("Déménagement 🚚"), "Déménagement ??");
});

test("génère un PDF valide, sur plusieurs pages si nécessaire", async () => {
  const bytes = await renderQuotePdf({
    title: "Estimation indicative",
    reference: "DS-0001-V1",
    createdAt: "24 novembre 2026",
    validUntil: "24 décembre 2026",
    isEstimate: true,
    company: { name: "Déménagements Test", legal: ["SIRET 12345678900012"], color: "#0f766e" },
    customer: ["Jeanne Martin"],
    addresses: [{ title: "Départ", lines: ["1 rue de Paris, 75001 Paris", "3e étage, sans ascenseur"] }],
    facts: [["Volume", "18,4 m³"]],
    inventory: [{ room: "Salon", items: Array.from({ length: 80 }, (_, i) => `Objet ${i} - Sûr`) }],
    lines: [{ label: "Volume à déménager", detail: "18,4 m³ × 85 €", amount: "1 564,00 €" }],
    totals: [["Total HT", "1 564,00 €"], ["TVA (20 %)", "312,80 €"], ["Total TTC", "1 876,80 €"]],
    notes: ["Distance estimée."],
    terms: [["Assurance", "Contrat n° 42"]],
    footer: "Déménagements Test",
  });
  const head = Buffer.from(bytes.slice(0, 5)).toString();
  assert.equal(head, "%PDF-");
  assert.ok(bytes.length > 2000);
});
