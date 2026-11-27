/**
 * Demandes successives depuis le même appareil (Chromium, émulation mobile) :
 * A nouvelle demande après envoi, B retour sur le lien public après fermeture du navigateur,
 * C reprise d'une demande en cours et « Recommencer depuis le début », D plusieurs demandes
 * indépendantes visibles dans l'espace pro, E données des demandes précédentes intactes,
 * et « Nouvelle simulation » réservée aux entreprises de démonstration.
 * Inventaire manuel : aucune analyse IA, aucun appel externe payant.
 *
 * Prérequis : Supabase local, application lancée (npm run dev) SANS DEVIS_SCAN_TEST_TOOLS.
 * Lancer : npm run test:e2e:nouvelles-demandes
 */
const { chromium, devices } = require("playwright");
const assert = require("node:assert/strict");
const path = require("node:path");
const { createClient } = require("@supabase/supabase-js");

process.loadEnvFile?.(".env.local");
const APP = process.env.E2E_APP_URL || "http://localhost:3000";
const SHOTS = process.env.E2E_SCREENSHOTS || "";
const DB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
assert.match(DB_URL, /127\.0\.0\.1|localhost/, "Test réservé à Supabase local");
const admin = createClient(DB_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
const stamp = Date.now().toString(36);
let step = 0;
let current = null;
const errors = [];
const log = (m) => console.log(`✓ ${String(++step).padStart(2, "0")} ${m}`);
const shot = async (page, name) => { if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage: true }); };
const text = (page, t, timeout = 15000) => page.getByText(t, { exact: false }).first().waitFor({ timeout });
const day = (days) => new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
const ADDRESS_FIXTURE = (q) => ({
  type: "FeatureCollection",
  features: /lyon|république/i.test(q)
    ? [{ type: "Feature", geometry: { type: "Point", coordinates: [4.8357, 45.764] }, properties: { label: "12 Rue de la République 69002 Lyon", name: "12 Rue de la République", postcode: "69002", city: "Lyon" } }]
    : [{ type: "Feature", geometry: { type: "Point", coordinates: [4.8467, 45.7485] }, properties: { label: "3 Rue Garibaldi 69007 Lyon", name: "3 Rue Garibaldi", postcode: "69007", city: "Lyon" } }],
});

async function company(label, { demo = false } = {}) {
  const email = `${label}-${stamp}@test.local`;
  const password = "Demenage2026";
  await admin.auth.admin.createUser({ email, password, email_confirm: true });
  const client = createClient(DB_URL, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
  await client.auth.signInWithPassword({ email, password });
  const { data: c, error } = await client.rpc("create_company", { company_name: `${label} ${stamp}` });
  assert.equal(error, null);
  await client.from("pricing_settings").update({ price_per_m3: 45, minimum_price: 200, price_per_extra_km: 0 }).eq("company_id", c.id);
  await admin.from("companies").update({ legal_name: `${label} SARL`, siret: "12345678900012", address_line1: "1 rue du Test", postal_code: "69001", city: "Lyon", is_demo: demo }).eq("id", c.id);
  return { ...c, email, password };
}

async function newContext(browser, storageState) {
  const ctx = await browser.newContext({ ...devices["Pixel 7"], ...(storageState ? { storageState } : {}) });
  await ctx.route("https://data.geopf.fr/geocodage/search**", (route) =>
    route.fulfill({ json: ADDRESS_FIXTURE(new URL(route.request().url()).searchParams.get("q") ?? ""), headers: { "access-control-allow-origin": "*" } }));
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("dialog", (d) => d.accept());
  current = page;
  return { ctx, page };
}

async function fillTrip(page, { floor, date }) {
  for (const [label, typed] of [["Adresse de départ", "3 rue garibaldi"], ["Adresse d'arrivée", "12 rue de la république lyon"]]) {
    await page.getByLabel(label, { exact: true }).fill(typed);
    await page.getByRole("listbox").getByRole("option").first().click();
  }
  await page.getByRole("radio", { name: "Appartement" }).first().check({ force: true });
  await page.locator("#origin-floor").selectOption(String(floor));
  await page.getByRole("radio", { name: "Pas d'ascenseur" }).first().check({ force: true });
  await page.getByRole("radio", { name: "Appartement" }).nth(1).check({ force: true });
  await page.locator("#destination-floor").selectOption("0");
  await page.getByRole("radio", { name: "Ascenseur standard" }).nth(1).check({ force: true });
  await page.locator("#moving_date").fill(date);
  await page.getByRole("button", { name: "Continuer" }).click();
  await page.waitForURL(/coordonnees$/);
}

async function fillContact(page, first, last) {
  await page.getByLabel("Prénom").fill(first);
  await page.getByLabel("Nom", { exact: true }).fill(last);
  await page.getByLabel("E-mail").fill(`client-${stamp}@example.com`); // même personne, même adresse e-mail
  await page.getByLabel("Téléphone").fill("06 12 34 56 78");
  await page.getByRole("checkbox", { name: /J'accepte que mes informations/ }).check();
  await page.getByRole("button", { name: "Continuer" }).click();
  await page.waitForURL(/methode$/);
}

/** Demande complète « inventaire manuel » à partir de l'étape 1 ; renvoie le lien de suivi. */
async function completeRequest(page, { first, last, floor, date, boxes, sofas }) {
  await fillTrip(page, { floor, date });
  await fillContact(page, first, last);
  await page.getByTestId("method-manual").click();
  await page.getByRole("button", { name: "Continuer" }).click();
  await page.waitForURL(/demande\/inventaire$/);
  await page.locator("#extra-boxes").fill(String(boxes));
  await page.getByTestId("boxes-continue").click();
  for (let i = 0; i < sofas; i++) await page.locator('[data-testid=scene-object][data-catalog-key="canape-3-places"]').click();
  await page.locator("[data-testid=sync-status][data-status=idle]").waitFor({ timeout: 15000 });
  await page.getByTestId("inventory-continue").click();
  await page.waitForURL(/recapitulatif$/);
  await page.getByLabel("J'ai pris connaissance de cet avertissement.").check();
  await page.getByRole("button", { name: "Valider mon inventaire et recevoir mon devis" }).click();
  await page.waitForURL(/\/devis\/[0-9a-f]{64}$/, { timeout: 30000 });
  await text(page, "Prestations comprises", 30000);
  return page.url();
}

async function assertBlankTrip(page) {
  await page.waitForURL(/demande\/trajet$/);
  await page.getByTestId("restart-request").waitFor({ state: "detached", timeout: 10000 });
  assert.equal(await page.getByLabel("Adresse de départ", { exact: true }).inputValue(), "", "adresse vierge");
  assert.equal(await page.locator("#moving_date").inputValue(), "", "date vierge");
  assert.equal(await page.getByTestId("restart-request").count(), 0, "aucune demande en cours");
}

/** Photographie d'une demande (pour vérifier ensuite qu'elle n'a pas changé). */
async function snapshot(requestId) {
  const { data: r } = await admin.from("quote_requests").select("id, status, moving_date, extra_boxes, customer_validated_at, customers(full_name, phone), dwellings(kind, floor)").eq("id", requestId).single();
  const { data: items } = await admin.from("inventory_items").select("id, catalog_key, quantity, unit_volume_m3, removed").eq("request_id", requestId).order("id");
  const { data: quotes } = await admin.from("quotes").select("id, version, status, total_ttc_cents, lines").eq("request_id", requestId).order("version");
  r.dwellings.sort((a, b) => a.kind.localeCompare(b.kind));
  return JSON.stringify({ r, items, quotes });
}

(async () => {
  const pro = await company("successives");
  const slug = pro.slug;
  const browser = await chromium.launch();
  let { ctx, page } = await newContext(browser);
  const requestsOf = async () => (await admin.from("quote_requests").select("id, status, is_test, created_at, customers(full_name)").eq("company_id", pro.id).order("created_at")).data;

  // ---------------- Test A : nouvelle demande après envoi ----------------
  await page.goto(`${APP}/d/${slug}`);
  await page.getByTestId("start-request").click();
  const url1 = await completeRequest(page, { first: "Léa", last: "Martin", floor: 2, date: day(30), boxes: 5, sofas: 1 });
  let rows = await requestsOf();
  assert.equal(rows.length, 1);
  const req1 = rows[0].id;
  assert.equal(rows[0].status, "quote_sent");
  const snap1 = await snapshot(req1);
  await shot(page, "n01-devis-envoye");
  await page.getByTestId("new-request").click();
  await assertBlankTrip(page);
  await shot(page, "n02-nouvelle-demande-vierge");
  rows = await requestsOf();
  assert.equal(rows.length, 1, "rien n'est créé ni supprimé tant que l'étape 1 n'est pas remplie");
  assert.equal(await snapshot(req1), snap1, "première demande intacte");
  log("Test A : après l'envoi, « Nouvelle demande de devis » ramène à l'étape 1, champs vierges ; la demande envoyée existe toujours, inchangée");

  // La demande envoyée reste consultable, en lecture seule
  await page.goto(`${APP}/d/${slug}/demande/envoyee`);
  await text(page, "Demande envoyée");
  await text(page, "Léa");
  await page.goto(`${APP}/d/${slug}/demande/recapitulatif`);
  await page.waitForURL(/envoyee$/);
  log("Demande envoyée consultable (écran de confirmation) et jamais modifiable : les étapes 2 à 5 y renvoient");

  // ---------------- Test D (2e demande) depuis le même appareil ----------------
  await page.goto(`${APP}/d/${slug}/demande/trajet`);
  const url2 = await completeRequest(page, { first: "Léa", last: "Martin-Durand", floor: 4, date: day(60), boxes: 12, sofas: 2 });
  assert.notEqual(url2, url1, "nouveau lien de suivi");
  rows = await requestsOf();
  assert.equal(rows.length, 2);
  const req2 = rows[1].id;
  assert.notEqual(req2, req1);
  const snap2 = await snapshot(req2);
  assert.equal(await snapshot(req1), snap1, "la deuxième demande n'a rien changé à la première");
  log("Deuxième demande complète depuis le même téléphone : nouvel identifiant, nouveau lien de suivi, première demande intacte");

  // ---------------- Test B : navigateur fermé puis lien public rouvert ----------------
  const state = await ctx.storageState();
  await ctx.close();
  ({ ctx, page } = await newContext(browser, state));
  await page.goto(`${APP}/d/${slug}`);
  await page.getByTestId("see-last-request").waitFor();
  assert.equal(await page.getByTestId("resume-request").count(), 0, "la demande terminée n'est pas rechargée comme demande en cours");
  assert.equal(await page.getByTestId("new-simulation").count(), 0, "« Nouvelle simulation » absente pour une entreprise réelle");
  await shot(page, "n03-lien-public-apres-envoi");
  await page.getByTestId("new-request").click();
  await assertBlankTrip(page);
  log("Test B : navigateur fermé puis rouvert, le lien public propose « Voir ma demande » et une nouvelle demande vierge (aucune simulation proposée pour une entreprise réelle)");

  // ---------------- Test C : demande en cours, reprise puis « Recommencer » ----------------
  await fillTrip(page, { floor: 3, date: day(90) });
  await page.getByLabel("Prénom").fill("Paul");
  const state2 = await ctx.storageState();
  await ctx.close();
  ({ ctx, page } = await newContext(browser, state2));
  await page.goto(`${APP}/d/${slug}`);
  await page.getByTestId("resume-request").click();
  await page.waitForURL(/trajet$/);
  assert.equal(await page.locator("#origin-floor").inputValue(), "3", "demande en cours reprise");
  assert.equal(await page.locator("#moving_date").inputValue(), day(90));
  rows = await requestsOf();
  assert.equal(rows.length, 3);
  const draft3 = rows[2];
  assert.equal(draft3.status, "draft");
  await shot(page, "n04-reprise");
  await page.getByTestId("restart-request").click();
  await assertBlankTrip(page);
  rows = await requestsOf();
  assert.equal(rows.length, 3, "« Recommencer » ne supprime rien");
  assert.equal(rows[2].status, "draft", "le brouillon abandonné reste en base (règle habituelle des abandons)");
  log("Test C : demande commencée, navigateur fermé, reprise avec ses informations ; « Recommencer depuis le début » repart d'un formulaire vierge sans rien supprimer");

  // 3e demande complète
  const url3 = await completeRequest(page, { first: "Hugo", last: "Petit", floor: 1, date: day(120), boxes: 0, sofas: 1 });
  assert.ok(![url1, url2].includes(url3));
  rows = await requestsOf();
  const sent = rows.filter((r) => r.status !== "draft");
  assert.equal(sent.length, 3);
  assert.equal(new Set(sent.map((r) => r.id)).size, 3);

  // ---------------- Test D : espace pro ----------------
  const proPage = await (await browser.newContext({ viewport: { width: 1360, height: 900 } })).newPage();
  proPage.on("pageerror", (e) => errors.push(String(e)));
  await proPage.goto(`${APP}/connexion`);
  await proPage.getByLabel("Adresse e-mail").fill(pro.email);
  await proPage.getByLabel("Mot de passe").fill(pro.password);
  await proPage.getByRole("button", { name: "Se connecter" }).click();
  await proPage.waitForURL(/\/espace$/);
  await proPage.goto(`${APP}/espace/demandes`);
  for (const name of ["Léa Martin", "Léa Martin-Durand", "Hugo Petit"]) await proPage.getByRole("link", { name, exact: true }).first().waitFor();
  assert.equal(await proPage.locator("table tbody tr").count(), 3, "trois demandes envoyées, le brouillon abandonné n'apparaît pas");
  await shot(proPage, "n05-espace-pro");
  log(`Test D : trois demandes successives depuis le même téléphone, trois identifiants distincts, trois lignes indépendantes dans l'espace pro`);

  // ---------------- Test E : conservation ----------------
  assert.equal(await snapshot(req1), snap1, "demande 1 : coordonnées, logements, inventaire, devis inchangés");
  assert.equal(await snapshot(req2), snap2, "demande 2 inchangée");
  const { data: customers } = await admin.from("quote_requests").select("customer_id").in("id", [req1, req2]);
  assert.notEqual(customers[0].customer_id, customers[1].customer_id, "fiche client propre à chaque demande (même e-mail)");
  for (const [id, name] of [[req1, "Léa Martin"], [req2, "Léa Martin-Durand"]]) {
    await proPage.goto(`${APP}/espace/demandes/${id}`);
    await text(proPage, name);
    await text(proPage, "Carton standard");
  }
  log("Test E : demandes 1 et 2 identiques octet pour octet (coordonnées, logements, inventaire, devis) ; une fiche client par demande ; fiches pro intactes");

  // ---------------- Nouvelle simulation (entreprise de démonstration) ----------------
  const demo = await company("demo", { demo: true });
  const s = await newContext(browser);
  await s.page.goto(`${APP}/d/${demo.slug}`);
  await s.page.getByTestId("new-simulation").click();
  await s.page.waitForURL(/trajet$/);
  await fillTrip(s.page, { floor: 0, date: day(45) });
  const { data: demoRows } = await admin.from("quote_requests").select("id, is_test").eq("company_id", demo.id);
  assert.deepEqual(demoRows.map((r) => r.is_test), [true], "demande marquée « simulation »");
  const { data: realRows } = await admin.from("quote_requests").select("is_test").eq("company_id", pro.id);
  assert.ok(realRows.every((r) => r.is_test === false), "aucune demande réelle marquée");
  await page.goto(`${APP}/d/${slug}`);
  assert.equal(await page.getByTestId("new-simulation").count(), 0);
  log("« Nouvelle simulation » : proposée seulement pour une entreprise de démonstration, demande marquée « simulation » ; absente pour une entreprise réelle, dont aucune demande n'est marquée");

  assert.deepEqual(errors, [], errors.join("\n"));
  await browser.close();
  console.log(`\nDemandes successives : réussi (${step} vérifications).`);
})().catch(async (e) => {
  console.error("\n✗ ÉCHEC :", e.message);
  if (current) {
    console.error("Page :", current.url(), "\nErreurs JS :", errors.join("\n"));
    console.error((await current.locator("main").innerText().catch(() => "")).slice(0, 1500));
  }
  process.exit(1);
});
