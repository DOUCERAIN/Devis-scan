import { test } from "node:test";
import assert from "node:assert/strict";
import { dwellingsSchema, roomSchema, tripSchema } from "./public-request.ts";
import { containerMatchesMime, detectVideoContainer, formatBytes } from "../video/signature.ts";

const future = (days: number) => new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
const address = { address_line: "8 Boulevard du Port", postal_code: "95000", city: "Cergy", latitude: "49.03", longitude: "2.07" };

test("étape trajet : adresses, dates futures, accord obligatoire", () => {
  const ok = tripSchema.safeParse({
    customer: { full_name: "Lina Martin", email: "Lina@Example.com" },
    origin: address, destination: { ...address, city: "Lyon", latitude: "" },
    moving_date: future(20), alternative_moving_date: future(27), consent: "on",
  });
  assert.equal(ok.success, true, JSON.stringify(!ok.success && ok.error.issues));
  if (ok.success) {
    assert.equal(ok.data.customer.email, "lina@example.com");
    assert.equal(ok.data.origin.latitude, 49.03);
    assert.equal(ok.data.destination.latitude, undefined);
  }
  const bad = tripSchema.safeParse({ customer: {}, origin: {}, destination: {}, moving_date: "2020-01-01", alternative_moving_date: "2020-01-01" });
  assert.equal(bad.success, false);
  const paths = bad.success ? [] : bad.error.issues.map((i) => i.path.join("."));
  for (const p of ["customer.full_name", "customer.email", "origin.address_line", "origin.city", "moving_date", "consent"]) {
    assert.ok(paths.includes(p), `erreur attendue sur ${p}`);
  }
});

test("étape trajet : date alternative différente", () => {
  const d = future(10);
  const r = tripSchema.safeParse({ customer: { full_name: "Lina", email: "l@x.fr" }, origin: address, destination: address, moving_date: d, alternative_moving_date: d, consent: "on" });
  assert.equal(r.success, false);
  assert.ok(!r.success && r.error.issues.some((i) => i.path.join(".") === "alternative_moving_date"));
});

test("étape logements : type et ascenseur obligatoires, nombres contrôlés", () => {
  const base = { housing_type: "apartment", elevator: "none", floor: "3", surface_m2: "65" };
  assert.equal(dwellingsSchema.safeParse({ origin: base, destination: { ...base, housing_type: "house" } }).success, true);
  assert.equal(dwellingsSchema.safeParse({ origin: { ...base, floor: "trois" }, destination: base }).success, false);
  assert.equal(dwellingsSchema.safeParse({ origin: { elevator: "none" }, destination: base }).success, false);
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
