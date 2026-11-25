/**
 * Parcours client « inventaire manuel » de bout en bout (navigateur Chromium en émulation mobile) :
 * déménagement (étages, dates alternatives), coordonnées entreprise sans SIRET, choix de la méthode,
 * inventaire par catégories (catalogue, recherche, taille approximative, objet personnalisé, quantités,
 * retrait), récapitulatif, avertissement, devis immédiat, PDF, acceptation, réception par le déménageur.
 * Aucune analyse IA (aucun appel externe payant).
 *
 * Prérequis : Supabase local, application sur http://localhost:3000 avec .env.local (Supabase local).
 * Lancer : npm run test:e2e:manuel
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
const errors = [];
let current = null; // page affichée en cas d'échec (capture)
const log = (m) => console.log(`✓ ${String(++step).padStart(2, "0")} ${m}`);
const day = (days) => new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
const shot = async (page, name) => { if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage: true }); };
const text = (page, t, timeout = 15000) => page.getByText(t, { exact: false }).first().waitFor({ timeout });

const ADDRESS_FIXTURE = (q) => ({
  type: "FeatureCollection",
  features: /lyon|république/i.test(q)
    ? [{ type: "Feature", geometry: { type: "Point", coordinates: [4.8357, 45.764] }, properties: { label: "12 Rue de la République 69002 Lyon", name: "12 Rue de la République", postcode: "69002", city: "Lyon" } }]
    : [{ type: "Feature", geometry: { type: "Point", coordinates: [4.8467, 45.7485] }, properties: { label: "3 Rue Garibaldi 69007 Lyon", name: "3 Rue Garibaldi", postcode: "69007", city: "Lyon" } }],
});

(async () => {
  // Déménageur : grille enregistrée, identité légale complète.
  const email = `manuel-${stamp}@test.local`;
  const password = "Demenage2026";
  await admin.auth.admin.createUser({ email, password, email_confirm: true });
  const proClient = createClient(DB_URL, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
  await proClient.auth.signInWithPassword({ email, password });
  const { data: company, error } = await proClient.rpc("create_company", { company_name: `Manuel ${stamp}` });
  assert.equal(error, null);
  await proClient.from("pricing_settings").update({ price_per_m3: 50, minimum_price: 200, price_per_extra_km: 0, floor_fee_without_elevator: 15 }).eq("company_id", company.id);
  await admin.from("companies").update({ legal_name: "Manuel SARL", siret: "12345678900012", address_line1: "1 rue du Test", postal_code: "69001", city: "Lyon" }).eq("id", company.id);
  const slug = company.slug;

  const browser = await chromium.launch();
  const ctx = await browser.newContext({ ...devices["Pixel 7"] });
  await ctx.route("https://data.geopf.fr/geocodage/search**", (route) =>
    route.fulfill({ json: ADDRESS_FIXTURE(new URL(route.request().url()).searchParams.get("q") ?? ""), headers: { "access-control-allow-origin": "*" } }));
  const page = await ctx.newPage();
  current = page;
  page.on("pageerror", (e) => errors.push(String(e)));

  // 1. Déménagement
  await page.goto(`${APP}/d/${slug}/demande/trajet`);
  for (const [label, typed] of [["Adresse de départ", "3 rue garibaldi"], ["Adresse d'arrivée", "12 rue de la république lyon"]]) {
    await page.getByLabel(label, { exact: true }).fill(typed);
    await page.getByRole("listbox").getByRole("option").first().click();
  }
  await page.getByRole("radio", { name: "Appartement" }).first().check({ force: true });
  await page.locator("#origin-floor").selectOption("2");
  await page.getByRole("radio", { name: "Pas d'ascenseur" }).first().check({ force: true });
  await page.getByRole("radio", { name: "Appartement" }).nth(1).check({ force: true });
  await page.locator("#destination-floor").selectOption("0");
  await page.getByRole("radio", { name: "Ascenseur standard" }).nth(1).check({ force: true });
  await page.locator("#moving_date").fill(day(40));
  await page.getByRole("button", { name: "Ajouter une date alternative" }).click();
  await page.getByLabel(/^Date alternative 1/).fill(day(41));
  await page.getByRole("button", { name: "Continuer" }).click();
  await page.waitForURL(/coordonnees$/);
  log("Déménagement : adresses, étages (2e et rez-de-chaussée), ascenseur, date et date alternative");

  // 2. Coordonnées : entreprise sans SIRET
  await page.getByText("Entreprise", { exact: true }).click();
  await page.getByRole("button", { name: "Continuer" }).click();
  await text(page, "Le nom de l'entreprise est obligatoire.");
  await page.getByLabel("Nom de l'entreprise").fill("Acme Conseil");
  await page.getByLabel(/SIRET/).fill("123");
  await page.getByLabel("Prénom").fill("Paul");
  await page.getByLabel("Nom", { exact: true }).fill("Durand");
  await page.getByLabel("E-mail").fill(`paul-${stamp}@example.com`);
  await page.getByLabel("Téléphone").fill("04 72 00 00 00");
  await page.getByRole("checkbox", { name: /J'accepte que mes informations/ }).check();
  await page.getByRole("button", { name: "Continuer" }).click();
  await text(page, "Le SIRET comporte 14 chiffres.");
  await page.getByLabel(/SIRET/).fill("");
  await page.getByRole("checkbox", { name: /J'accepte que mes informations/ }).check();
  await page.getByRole("button", { name: "Continuer" }).click();
  await page.waitForURL(/methode$/);
  log("Coordonnées entreprise : nom exigé, SIRET contrôlé mais facultatif");

  // 3. Méthode manuelle
  await page.getByTestId("method-manual").click();
  await page.getByRole("button", { name: "Continuer" }).click();
  await page.waitForURL(/demande\/inventaire$/);
  await text(page, "Votre inventaire est vide.");
  for (const label of ["Salon", "Chambres", "Cuisine", "Salle de bain", "Bureau", "Garage et cave", "Autres espaces"]) {
    assert.ok(await page.getByRole("tab", { name: label }).isVisible(), `catégorie ${label}`);
  }
  log("Méthode « Faire mon inventaire manuellement » : sept catégories");

  // 4. Inventaire : catalogue, quantités, taille approximative, recherche, objet personnalisé
  const total = () => page.getByTestId("inventory-total").innerText();
  await page.getByRole("button", { name: "Ajouter un Canapé 3 places" }).click();
  await text(page, "« Canapé 3 places » ajouté.");
  await page.getByRole("button", { name: "Ajouter un Canapé 3 places" }).click();
  await page.waitForFunction(() => document.querySelector("[data-testid=inventory-total]")?.textContent?.startsWith("2 objets"));
  await page.getByRole("tab", { name: "Chambres" }).click();
  await page.getByRole("button", { name: "Ajouter un Armoire 3 portes" }).click();
  await text(page, "Quelle est sa taille, environ ?");
  await page.getByRole("button", { name: /^Grand/ }).click();
  await text(page, "« Armoire 3 portes » ajouté.");
  await page.getByPlaceholder(/Rechercher/).fill("frigo");
  await page.getByRole("button", { name: /^Ajouter un Réfrigérateur/ }).first().click();
  await text(page, "ajouté.");
  await page.getByPlaceholder(/Rechercher/).fill("");
  await page.getByRole("button", { name: "Ajouter un objet personnalisé." }).click();
  const form = page.getByTestId("custom-item-form");
  await form.getByLabel("Description").fill("");
  await form.getByRole("button", { name: "Ajouter cet objet" }).click();
  await text(page, "Indiquez une taille approximative ou les dimensions");
  await form.getByLabel("Description").fill("Aquarium 200 L");
  await form.getByText("Je connais ses dimensions").click();
  await form.getByLabel("Largeur (cm)").fill("100");
  await form.getByLabel("Profondeur (cm)").fill("40");
  await form.getByLabel("Hauteur (cm)").fill("50");
  await form.getByLabel("Commentaire").fill("Vidé avant le jour J");
  await shot(page, "m01-objet-personnalise");
  await form.getByRole("button", { name: "Ajouter cet objet" }).click();
  await text(page, "« Aquarium 200 L » ajouté.");
  await text(page, "« Vidé avant le jour J »");
  await text(page, "volume calculé avec vos dimensions");
  await text(page, "volume d'un objet de taille comparable");
  // Quantité diminuée puis retrait d'un objet
  await page.getByRole("button", { name: "Diminuer la quantité : Canapé 3 places" }).click();
  await page.getByRole("button", { name: /^Retirer : Réfrigérateur/ }).click();
  await page.waitForFunction(() => document.querySelectorAll("[data-testid=inventory-item]").length === 3);
  const summary = await total();
  assert.match(summary, /^3 objets · 2,52 m³$/, summary); // 1,5 + 0,8 + 1,1 × 0,2 = 2,52
  await shot(page, "m02-inventaire");
  const { data: items } = await admin.from("inventory_items").select("name, quantity, unit_volume_m3, volume_source, volume_note, removed, source, customer_comment").eq("company_id", company.id).order("created_at");
  assert.deepEqual(items.map((i) => [i.name, i.quantity, Number(i.unit_volume_m3), i.volume_source, i.removed, i.source]), [
    ["Canapé 3 places", 1, 1.5, "catalog", false, "customer"],
    ["Armoire 3 portes", 1, 0.8, "comparable", false, "customer"],
    [items[2].name, 1, Number(items[2].unit_volume_m3), "catalog", true, "customer"],
    ["Aquarium 200 L", 1, 0.22, "dimensions", false, "customer"],
  ]);
  assert.match(items[1].volume_note, /comparable à « Armoire 2 portes »/);
  assert.equal(items[3].customer_comment, "Vidé avant le jour J");
  log("Inventaire : catalogue, quantités, taille approximative (volume d'un objet comparable, justifié), recherche, objet personnalisé avec dimensions, retrait sans effacement");

  // 5. Récapitulatif, avertissement, envoi → devis immédiat
  await page.getByRole("button", { name: "Vérifier et continuer" }).click();
  await page.waitForURL(/recapitulatif$/);
  await text(page, "Inventaire (3 objets");
  await text(page, "Acme Conseil");
  await page.getByRole("button", { name: "Valider mon inventaire et recevoir mon devis" }).click();
  await text(page, "Confirmez avoir pris connaissance de l'avertissement");
  await page.getByLabel("J'ai pris connaissance de cet avertissement.").check();
  await shot(page, "m03-recapitulatif");
  await page.getByRole("button", { name: "Valider mon inventaire et recevoir mon devis" }).click();
  await page.waitForURL(/\/devis\/[0-9a-f]{64}$/, { timeout: 30000 });
  const quoteUrl = page.url();
  await text(page, "Détail du prix", 30000);
  await text(page, "taille approximative");
  await shot(page, "m04-devis");
  const { data: req } = await admin.from("quote_requests").select("id, status, inventory_method, verification_status, customer_acknowledgement").eq("company_id", company.id).single();
  assert.equal(req.inventory_method, "manual");
  assert.equal(req.status, "quote_sent");
  assert.equal(req.verification_status, "pending");
  assert.match(req.customer_acknowledgement, /^Merci de vérifier attentivement votre inventaire/);
  const { data: quotes } = await admin.from("quotes").select("version, status, origin, total_ttc_cents").eq("request_id", req.id);
  assert.deepEqual(quotes.map((q) => [q.version, q.status, q.origin]), [[1, "sent", "customer_validation"]]);
  const { count: runs } = await admin.from("analysis_runs").select("id", { count: "exact", head: true }).eq("request_id", req.id);
  assert.equal(runs, 0, "aucune analyse IA pour un inventaire manuel");
  const pdf = await page.request.get(`${quoteUrl}/pdf`);
  assert.equal(pdf.status(), 200);
  assert.equal((await pdf.body()).subarray(0, 5).toString(), "%PDF-");
  log(`Envoi : devis final V1 calculé immédiatement (${(quotes[0].total_ttc_cents / 100).toFixed(2)} € TTC), sans analyse IA ; PDF`);

  await page.getByRole("button", { name: "Accepter le devis" }).click();
  await text(page, "Vous avez accepté ce devis");
  log("Devis accepté en ligne");

  // 6. Le déménageur reçoit le dossier complet
  const pro = await (await browser.newContext({ viewport: { width: 1360, height: 900 } })).newPage();
  pro.on("pageerror", (e) => errors.push(String(e)));
  await pro.goto(`${APP}/connexion`);
  await pro.getByLabel("Adresse e-mail").fill(email);
  await pro.getByLabel("Mot de passe").fill(password);
  await pro.getByRole("button", { name: "Se connecter" }).click();
  await pro.waitForURL(/\/espace$/);
  await pro.goto(`${APP}/espace/demandes/${req.id}`);
  for (const t of ["Paul Durand", "Inventaire saisi par le client", "Client entreprise", "Acme Conseil", "SIRET non communiqué", "Ajouté par le client",
    "Commentaire du client : « Vidé avant le jour J »", "comparable à « Armoire 2 portes »", "Dossier de vérification", "Devis accepté par le client"]) {
    await text(pro, t);
  }
  await shot(pro, "m05-fiche-pro");
  log("Espace pro : coordonnées entreprise, méthode, objets ajoutés par le client avec justification du volume, dossier de vérification");

  // 7. Inventaire figé après validation ; mobile sans débordement
  await page.goto(`${APP}/d/${slug}/demande/inventaire`);
  await page.waitForURL(/envoyee$/);
  const m = await (await browser.newContext({ ...devices["iPhone SE"] })).newPage();
  await m.goto(`${APP}/d/${slug}/demande/trajet`);
  assert.equal(await m.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), 0);
  log("Après l'envoi, l'inventaire n'est plus modifiable ; petit écran sans débordement");

  assert.deepEqual(errors, [], errors.join("\n"));
  await browser.close();
  console.log(`\nParcours manuel réussi (${step} vérifications).`);
})().catch(async (e) => {
  console.error("\n✗ ÉCHEC :", e.message);
  if (current) {
    console.error("Page :", current.url(), "\nErreurs JS :", errors.join("\n"));
    console.error((await current.locator("body").innerText().catch(() => "")).slice(0, 1500));
  }
  process.exit(1);
});
