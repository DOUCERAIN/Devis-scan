import { test } from "node:test";
import assert from "node:assert/strict";
import { checkAlternativeDates, contactPayload, contactSchema, customItemSchema, roomSchema, tripPayload, tripSchema } from "./public-request.ts";
import { containerMatchesMime, detectVideoContainer, formatBytes } from "../video/signature.ts";

const future = (days: number) => new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
const address = { address_line: "8 Boulevard du Port", postal_code: "95000", city: "Cergy", latitude: "49.03", longitude: "2.07" };

const place = { ...address, housing_type: "apartment", floor: "0", elevator: "none" };

test("étape déménagement : adresses, étage obligatoire (rez-de-chaussée = 0), date future", () => {
  const ok = tripSchema.safeParse({ origin: place, destination: { ...place, city: "Lyon", latitude: "", floor: "3", elevator: "small" }, moving_date: future(20) });
  assert.equal(ok.success, true, JSON.stringify(!ok.success && ok.error.issues));
  if (ok.success) {
    assert.equal(ok.data.origin.floor, 0);
    assert.equal(ok.data.origin.latitude, 49.03);
    assert.equal(ok.data.destination.latitude, undefined);
    assert.equal(tripPayload(ok.data, [future(30)]).alternative_moving_dates.length, 1);
  }
  const bad = tripSchema.safeParse({ origin: { ...address, housing_type: "apartment", elevator: "none" }, destination: { ...place, floor: "" }, moving_date: "2020-01-01" });
  assert.equal(bad.success, false);
  const paths = bad.success ? [] : bad.error.issues.map((i) => i.path.join("."));
  for (const p of ["origin.floor", "destination.floor", "moving_date"]) assert.ok(paths.includes(p), `erreur attendue sur ${p}`);
  assert.equal(tripSchema.safeParse({ origin: { ...place, floor: "trois" }, destination: place, moving_date: future(5) }).success, false);
  assert.equal(tripSchema.safeParse({ origin: { ...place, elevator: undefined }, destination: place, moving_date: future(5) }).success, false);
});

test("dates alternatives : multiples, facultatives, cohérentes", () => {
  const main = future(10);
  assert.deepEqual(checkAlternativeDates([], main), { dates: [], errors: {} });
  assert.deepEqual(checkAlternativeDates(["", " "], main), { dates: [], errors: {} });
  const ok = checkAlternativeDates([future(14), future(12)], main);
  assert.deepEqual(ok.dates, [future(12), future(14)]);
  const bad = checkAlternativeDates([main, "2020-01-01", future(12), future(12), "31/12/2027"], main);
  assert.deepEqual(Object.keys(bad.errors).sort(), ["alternative_moving_dates.0", "alternative_moving_dates.1", "alternative_moving_dates.3", "alternative_moving_dates.4"]);
  assert.deepEqual(bad.dates, [future(12)]);
  assert.ok(checkAlternativeDates(Array.from({ length: 31 }, (_, i) => future(i + 20)), main).errors.alternative_moving_dates);
});

test("coordonnées : particulier, entreprise (SIRET facultatif), téléphone et accord obligatoires", () => {
  const person = { type: "individual", first_name: "Léa", last_name: "Martin", email: "Lea@Example.com", phone: "06 12 34 56 78", privacy: "on" };
  const ok = contactSchema.safeParse(person);
  assert.equal(ok.success, true, JSON.stringify(!ok.success && ok.error.issues));
  if (ok.success) {
    assert.equal(ok.data.marketing, false, "offres commerciales jamais imposées");
    assert.equal(contactPayload(ok.data).customer.company_name, "");
  }
  const paths = (v: object) => { const r = contactSchema.safeParse(v); return r.success ? [] : r.error.issues.map((i) => i.path.join(".")); };
  assert.ok(paths({ ...person, phone: undefined }).includes("phone"));
  assert.ok(paths({ ...person, phone: "12" }).includes("phone"));
  assert.ok(paths({ ...person, privacy: undefined }).includes("privacy"));
  assert.ok(paths({ ...person, first_name: undefined }).includes("first_name"));
  assert.ok(paths({ ...person, type: "company" }).includes("company_name"));
  assert.ok(paths({ type: "company" }).includes("company_name"), "signalé avec les autres erreurs");
  assert.deepEqual(paths({ ...person, type: "company", company_name: "Acme" }), [], "SIRET facultatif");
  assert.ok(paths({ ...person, type: "company", company_name: "Acme", siret: "123" }).includes("siret"));
  const withSiret = contactSchema.safeParse({ ...person, type: "company", company_name: "Acme", siret: "123 456 789 00012", marketing: "on" });
  assert.equal(withSiret.success && contactPayload(withSiret.data).customer.siret, "12345678900012");
});

test("objet personnalisé : description obligatoire, dimensions complètes ou taille", () => {
  const base = { label: "Aquarium", category: "autres", quantity: "1" };
  assert.equal(customItemSchema.safeParse({ ...base, size: "medium" }).success, true);
  assert.equal(customItemSchema.safeParse({ ...base, width_cm: "100", depth_cm: "40", height_cm: "50" }).success, true);
  const issues = (v: object) => { const r = customItemSchema.safeParse(v); return r.success ? [] : r.error.issues.map((i) => i.path.join(".")); };
  assert.ok(issues(base).includes("size"));
  assert.ok(issues({ ...base, width_cm: "100" }).includes("height_cm"));
  assert.ok(issues({ ...base, label: "", size: "small" }).includes("label"));
  assert.deepEqual(issues({ ...base, label: "" }).sort(), ["label", "size"], "tous les messages d'un coup");
  assert.ok(issues({ ...base, quantity: "0", size: "small" }).includes("quantity"));
  assert.ok(issues({ ...base, category: "grenier", size: "small" }).includes("category"));
});

test("pièces : nom obligatoire", () => {
  assert.equal(roomSchema.safeParse({ name: "Salon", kind: "living" }).success, true);
  assert.equal(roomSchema.safeParse({ name: "" }).success, false);
});

test("format réel des vidéos reconnu par les premiers octets", () => {
  const mp4 = new Uint8Array([0, 0, 0, 0x20, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d]);
  const mov = new Uint8Array([0, 0, 0, 0x14, 0x66, 0x74, 0x79, 0x70, 0x71, 0x74, 0x20, 0x20]);
  const webm = new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 0, 0, 0, 0, 0, 0, 0, 0]);
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0, 0, 0, 0, 0]);
  assert.equal(detectVideoContainer(mp4), "mp4");
  assert.equal(detectVideoContainer(mov), "quicktime");
  assert.equal(detectVideoContainer(webm), "webm");
  assert.equal(detectVideoContainer(png), null);
  assert.equal(containerMatchesMime("mp4", "video/mp4"), true);
  assert.equal(containerMatchesMime("quicktime", "video/mp4"), true);
  assert.equal(containerMatchesMime("webm", "video/mp4"), false);
  assert.equal(containerMatchesMime(null, "video/webm"), false);
  assert.equal(formatBytes(12.4 * 1024 * 1024), "12,4 Mo");
});
