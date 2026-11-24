import { test } from "node:test";
import assert from "node:assert/strict";
import { signUpSchema, newPasswordSchema } from "./auth.ts";
import { companyProfileSchema, brandColorSchema } from "./company.ts";
import { pricingSettingsSchema } from "./pricing.ts";
import { safeInternalPath } from "../form-data.ts";

test("inscription : mot de passe robuste et conditions acceptées", () => {
  const ok = signUpSchema.safeParse({ fullName: "Alice Martin", email: " Alice@Exemple.FR ", password: "motdepasse1", acceptTerms: "on" });
  assert.equal(ok.success, true);
  assert.equal(ok.success && ok.data.email, "alice@exemple.fr");
  const weak = signUpSchema.safeParse({ fullName: "Al", email: "a@b.fr", password: "motdepasse", acceptTerms: "on" });
  assert.equal(weak.success, false);
  const noTerms = signUpSchema.safeParse({ fullName: "Alice", email: "a@b.fr", password: "motdepasse1" });
  assert.equal(noTerms.success, false);
});

test("nouveau mot de passe : confirmation identique", () => {
  assert.equal(newPasswordSchema.safeParse({ password: "abcdefg1", confirmPassword: "abcdefg2" }).success, false);
  assert.equal(newPasswordSchema.safeParse({ password: "abcdefg1", confirmPassword: "abcdefg1" }).success, true);
});

test("entreprise : SIRET, TVA et site normalisés", () => {
  const r = companyProfileSchema.safeParse({ name: "Alpha", siret: "123 456 789 00012", vat_number: "fr 12 345678901", website: "alpha.fr" });
  assert.equal(r.success, true);
  if (r.success) {
    assert.equal(r.data.siret, "12345678900012");
    assert.equal(r.data.vat_number, "FR12345678901");
    assert.equal(r.data.website, "https://alpha.fr");
  }
  assert.equal(companyProfileSchema.safeParse({ name: "Alpha", siret: "123" }).success, false);
  assert.equal(brandColorSchema.safeParse({ brand_color: "#1F6E55" }).success, true);
  assert.equal(brandColorSchema.safeParse({ brand_color: "vert" }).success, false);
});

test("tarifs : virgule décimale acceptée, valeurs négatives refusées", () => {
  const base = {
    price_per_m3: "85,50", minimum_price: "380", travel_fee: "0", included_distance_km: "50", price_per_extra_km: "0.9",
    floor_fee_without_elevator: "22", floor_fee_small_elevator: "0", free_carrying_distance_m: "10",
    carrying_fee_per_10m: "5", heavy_item_fee: "65", vat_rate: "20",
  };
  const r = pricingSettingsSchema.safeParse(base);
  assert.equal(r.success, true);
  assert.equal(r.success && r.data.price_per_m3, 85.5);
  assert.equal(pricingSettingsSchema.safeParse({ ...base, travel_fee: "-3" }).success, false);
  assert.equal(pricingSettingsSchema.safeParse({ ...base, vat_rate: "120" }).success, false);
});

test("redirections : seuls les chemins internes sont acceptés", () => {
  assert.equal(safeInternalPath("/espace/demandes"), "/espace/demandes");
  assert.equal(safeInternalPath("https://pirate.example"), "/espace");
  assert.equal(safeInternalPath("//pirate.example"), "/espace");
  assert.equal(safeInternalPath(undefined), "/espace");
});

test("demande manuelle : toutes les erreurs signalées en une fois", async () => {
  const { manualRequestSchema } = await import("./request.ts");
  const r = manualRequestSchema.safeParse({ customer: {}, origin: {}, destination: {} });
  assert.equal(r.success, false);
  const paths = r.success ? [] : r.error.issues.map((i) => i.path.join("."));
  assert.ok(paths.includes("customer.full_name"));
  assert.ok(paths.includes("customer.email"));
  assert.ok(paths.includes("origin.city"));
});
