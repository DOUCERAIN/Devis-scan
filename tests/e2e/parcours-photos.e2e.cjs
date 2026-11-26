/**
 * Test C — parcours « photos uniquement », de bout en bout, dans Chromium en émulation mobile :
 * sélection multiple, aperçus, retrait avant validation, faux fichier, ajout ultérieur, réduction dans le
 * navigateur (JPEG 1 600 px), stockage privé, analyse globale de toutes les photos en plusieurs lots
 * (simulateur de test : AUCUN appel payant), meuble vu dans deux lots signalé « à vérifier », volumes du
 * catalogue, cartons, validation et devis final.
 *
 * Prérequis : Supabase local, application lancée avec AI_PROVIDER=simulation AI_ALLOW_SIMULATION=1,
 * photos de test générées par `npm run test:media`.
 * Lancer : npm run test:e2e:photos
 */
const { chromium, devices } = require("playwright");
const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");
const { createClient } = require("@supabase/supabase-js");

process.loadEnvFile?.(".env.local");
const APP = process.env.E2E_APP_URL || "http://localhost:3000";
const MEDIA = process.env.E2E_MEDIA || path.join(__dirname, "media");
const SHOTS = process.env.E2E_SCREENSHOTS || "";
const DB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
assert.match(DB_URL, /127\.0\.0\.1|localhost/, "Test réservé à Supabase local");
const admin = createClient(DB_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
const stamp = Date.now().toString(36);
let step = 0;
let current = null;
const errors = [];
const log = (m) => console.log(`✓ ${String(++step).padStart(2, "0")} ${m}`);
const media = (f) => {
  const p = path.join(MEDIA, f);
  assert.ok(fs.existsSync(p), `Fichier de test manquant : ${p} (lancez npm run test:media)`);
  return p;
};
const shot = async (page, name) => { if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage: true }); };
const text = (page, t, timeout = 15000) => page.getByText(t, { exact: false }).first().waitFor({ timeout });
const day = (days) => new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
const ADDRESS_FIXTURE = (q) => ({
  type: "FeatureCollection",
  features: /lyon|république/i.test(q)
    ? [{ type: "Feature", geometry: { type: "Point", coordinates: [4.8357, 45.764] }, properties: { label: "12 Rue de la République 69002 Lyon", name: "12 Rue de la République", postcode: "69002", city: "Lyon" } }]
    : [{ type: "Feature", geometry: { type: "Point", coordinates: [4.8467, 45.7485] }, properties: { label: "3 Rue Garibaldi 69007 Lyon", name: "3 Rue Garibaldi", postcode: "69007", city: "Lyon" } }],
});

(async () => {
  const email = `photos-${stamp}@test.local`;
  const password = "Demenage2026";
  await admin.auth.admin.createUser({ email, password, email_confirm: true });
  const proClient = createClient(DB_URL, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
  await proClient.auth.signInWithPassword({ email, password });
  const { data: company, error } = await proClient.rpc("create_company", { company_name: `Photos ${stamp}` });
  assert.equal(error, null);
  await proClient.from("pricing_settings").update({ price_per_m3: 45, minimum_price: 200, price_per_extra_km: 0 }).eq("company_id", company.id);
  await admin.from("companies").update({ legal_name: "Photos SARL", siret: "12345678900012", address_line1: "1 rue du Test", postal_code: "69001", city: "Lyon" }).eq("id", company.id);
  const slug = company.slug;

  const browser = await chromium.launch();
  const ctx = await browser.newContext({ ...devices["Pixel 7"] });
  await ctx.route("https://data.geopf.fr/geocodage/search**", (route) =>
    route.fulfill({ json: ADDRESS_FIXTURE(new URL(route.request().url()).searchParams.get("q") ?? ""), headers: { "access-control-allow-origin": "*" } }));
  const page = await ctx.newPage();
  current = page;
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("dialog", (d) => d.accept());

  // Étapes 1 à 3
  await page.goto(`${APP}/d/${slug}/demande/trajet`);
  for (const [label, typed] of [["Adresse de départ", "3 rue garibaldi"], ["Adresse d'arrivée", "12 rue de la république lyon"]]) {
    await page.getByLabel(label, { exact: true }).fill(typed);
    await page.getByRole("listbox").getByRole("option").first().click();
  }
  await page.getByRole("radio", { name: "Appartement" }).first().check({ force: true });
  await page.locator("#origin-floor").selectOption("1");
  await page.getByRole("radio", { name: "Ascenseur standard" }).first().check({ force: true });
  await page.getByRole("radio", { name: "Appartement" }).nth(1).check({ force: true });
  await page.locator("#destination-floor").selectOption("0");
  await page.getByRole("radio", { name: "Ascenseur standard" }).nth(1).check({ force: true });
  await page.locator("#moving_date").fill(day(30));
  await page.getByRole("button", { name: "Continuer" }).click();
  await page.waitForURL(/coordonnees$/);
  await page.getByLabel("Prénom").fill("Hugo");
  await page.getByLabel("Nom", { exact: true }).fill("Petit");
  await page.getByLabel("E-mail").fill(`hugo-${stamp}@example.com`);
  await page.getByLabel("Téléphone").fill("06 11 22 33 44");
  await page.getByRole("checkbox", { name: /J'accepte que mes informations/ }).check();
  await page.getByRole("button", { name: "Continuer" }).click();
  await page.waitForURL(/methode$/);
  await page.getByTestId("method-video").click();
  await page.getByRole("button", { name: "Continuer" }).click();
  await page.waitForURL(/medias$/);
  log("Étapes déménagement, coordonnées et méthode ; écran des médias");

  const photos = async () => (await admin.from("room_videos").select("id, status, media_kind, mime_type, width, height, size_bytes, storage_path, rooms(room_type), video_frames(storage_path, width, height)")
    .eq("company_id", company.id).eq("status", "uploaded").order("created_at")).data;

  // Sélection multiple, faux fichier, retrait avant validation
  await page.locator('input[data-input="photos"]').setInputFiles([media("photo-salon.jpg"), media("photo-chambre.jpg"), media("photo-cuisine.png"), media("faux.jpg")]);
  const pendingItems = page.getByTestId("media-pending");
  assert.equal(await pendingItems.count(), 4);
  assert.equal(await pendingItems.locator("img").count(), 4, "aperçu de chaque photo");
  await shot(page, "p01-selection");
  await pendingItems.filter({ hasText: "photo-chambre" }).getByRole("button", { name: /Retirer/ }).click();
  assert.equal(await pendingItems.count(), 3, "photo retirée avant validation");
  await page.getByTestId("media-send").click();
  await pendingItems.filter({ hasText: "faux.jpg" }).getByText(/ne peut pas être lue/).waitFor({ timeout: 30000 });
  await pendingItems.filter({ hasText: "faux.jpg" }).getByRole("button", { name: /Retirer/ }).click();
  await page.waitForFunction(() => document.querySelectorAll("[data-testid=media-sent-item]").length === 2);
  let sent = await photos();
  assert.equal(sent.length, 2);
  for (const p of sent) {
    assert.deepEqual([p.media_kind, p.mime_type, p.rooms.room_type], ["photo", "image/jpeg", "logement"]);
    assert.ok(Math.max(p.width, p.height) <= 1600, `${p.width}×${p.height}`);
    assert.equal(p.video_frames.length, 1, "la photo est sa propre image d'analyse");
    assert.equal(p.video_frames[0].storage_path, p.storage_path);
    const { data: file, error: dlError } = await admin.storage.from("request-media").download(p.storage_path);
    assert.equal(dlError, null);
    const head = Buffer.from(await file.slice(0, 3).arrayBuffer());
    assert.deepEqual([...head], [0xff, 0xd8, 0xff], "JPEG réellement stocké");
  }
  const big = sent.find((p) => p.width === 1600);
  assert.ok(big, "photo 4 000 × 3 000 ramenée à 1 600 px");
  log(`Photos : sélection multiple avec aperçus, une retirée avant validation, faux fichier refusé avec un message ; 2 photos JPEG stockées (4 000×3 000 → ${big.width}×${big.height}, PNG converti), chacune image d'analyse`);

  // Ajout ultérieur : 19 photos de plus (au-delà de 20 images, l'analyse se fait en plusieurs lots)
  const more = Array.from({ length: 19 }, (_, i) => media(i % 2 ? "photo-chambre.jpg" : "photo-salon.jpg"));
  await page.locator('input[data-input="photos"]').setInputFiles(more);
  await page.getByTestId("media-send").click();
  await page.waitForFunction(() => document.querySelectorAll("[data-testid=media-sent-item]").length === 21, null, { timeout: 120000 });
  sent = await photos();
  assert.equal(sent.length, 21);
  // Revoir puis supprimer une photo envoyée
  await page.getByTestId("media-sent-item").first().getByRole("button", { name: "Revoir" }).click();
  await page.getByTestId("media-sent-item").first().locator("img").waitFor();
  await shot(page, "p02-envoyees");
  log("Ajout ultérieur de 19 photos (21 au total) ; photo envoyée revue");

  // Récapitulatif et envoi
  await page.getByRole("link", { name: /vers le récapitulatif/i }).click();
  await page.waitForURL(/recapitulatif$/);
  await text(page, "21 photos");
  await page.getByRole("button", { name: /Envoyer ma demande/ }).click();
  await page.waitForURL(/\/devis\/[0-9a-f]{64}$/, { timeout: 30000 });
  const quoteUrl = page.url();
  await text(page, "Commençons par estimer vos cartons", 90000);
  const { data: req } = await admin.from("quote_requests").select("id, status").eq("company_id", company.id).single();
  const { data: run } = await admin.from("analysis_runs").select("status, simulated, rooms_total, rooms_done").eq("request_id", req.id).single();
  assert.equal(run.status, "succeeded");
  assert.equal(run.simulated, true);
  assert.equal(run.rooms_total, 2, "21 photos analysées ensemble, en deux lots");
  const { data: aiItems } = await admin.from("inventory_items").select("catalog_key, quantity, possible_duplicate, unit_volume_m3, volume_source, rooms(room_type)").eq("request_id", req.id).eq("source", "ai");
  assert.ok(aiItems.every((i) => i.rooms.room_type === "logement"));
  const sofas = aiItems.filter((i) => i.catalog_key === "canape-3-places");
  assert.equal(sofas.length, 2, "aucun objet retiré automatiquement");
  assert.deepEqual(sofas.map((s) => s.possible_duplicate).sort(), [false, true], "canapé revu dans le second lot : doublon possible");
  assert.ok(sofas.every((s) => Number(s.unit_volume_m3) === 1.5), "volume du catalogue (canapé 3 places : 1,5 m³)");
  log(`Analyse globale des 21 photos en ${run.rooms_total} lots (simulateur, aucun appel payant) ; canapé vu dans les deux lots signalé « doublon possible », rien retiré ; volumes lus dans le catalogue`);

  await page.getByTestId("boxes-detected").getByText("6 cartons").waitFor();
  await page.locator("#extra-boxes").fill("0");
  await page.getByTestId("boxes-continue").click();
  await page.getByTestId("room-scene").waitFor();
  assert.equal(await page.getByTestId("room-list").getByTestId("inventory-item").filter({ hasText: "Canapé 3 places" }).count(), 2);
  const toCheck = page.getByTestId("to-check").filter({ hasText: "Canapé 3 places" });
  assert.equal(await toCheck.count(), 1);
  await toCheck.getByLabel("C'est le même meuble : ne le compter qu'une fois").check();
  for (let i = 0; i < await page.getByTestId("to-check").count(); i++) {
    const item = page.getByTestId("to-check").nth(i);
    if (!(await item.locator("input:checked").count())) await item.getByLabel("C'est un autre meuble : garder les deux").check();
  }
  await page.getByLabel("J'ai pris connaissance de cet avertissement.").check();
  await shot(page, "p03-validation");
  await page.getByRole("button", { name: "Valider mon inventaire et recevoir mon devis" }).click();
  await text(page, "Prestations comprises", 30000);
  const { data: quote } = await admin.from("quotes").select("version, status, volume_snapshot").eq("request_id", req.id).single();
  assert.equal(quote.status, "sent");
  const { data: decided } = await admin.from("inventory_items").select("customer_duplicate_decision").eq("request_id", req.id).eq("catalog_key", "canape-3-places").eq("possible_duplicate", true).single();
  assert.equal(decided.customer_duplicate_decision, "same");
  await shot(page, "p04-devis");
  log(`Cartons : 6 repérés par l'analyse annoncés, 0 supplémentaire ; le client confirme que le canapé est le même ; devis final V1 transmis (volume facturé ${String(quote.volume_snapshot.billable_m3).replace(".", ",")} m³, doublon confirmé non compté)`);

  assert.deepEqual(errors, [], errors.join("\n"));
  await browser.close();
  console.log(`\nParcours photos réussi (${step} vérifications). Lien de suivi : ${quoteUrl.replace(/[0-9a-f]{64}$/, "<jeton>")}`);
})().catch(async (e) => {
  console.error("\n✗ ÉCHEC :", e.message);
  if (current) {
    console.error("Page :", current.url(), "\nErreurs JS :", errors.join("\n"));
    console.error((await current.locator("main").innerText().catch(() => "")).slice(0, 1500));
  }
  process.exit(1);
});
