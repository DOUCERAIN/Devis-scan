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
  // Option payante (prix connu du seul déménageur) : 37,00 € au forfait.
  const { error: optError } = await admin.from("pricing_options").insert({ company_id: company.id, name: "Emballage de la vaisselle", description: "Fourniture et emballage par nos soins", pricing_mode: "fixed", price: 37, is_active: true });
  assert.equal(optError, null);

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
  const reqRow = async () => (await admin.from("quote_requests").select("id, extra_boxes").eq("company_id", company.id).single()).data;
  const dbItems = async () => (await admin.from("inventory_items").select("name, catalog_key, quantity, unit_volume_m3, volume_source, volume_note, removed, source, customer_comment, room_id, rooms(name, room_type)")
    .eq("company_id", company.id).eq("removed", false).order("created_at")).data;
  const saved = () => page.locator("[data-testid=sync-status][data-status=idle]").waitFor({ timeout: 15000 });

  // 4E. Cartons : étape dédiée, obligatoire, zéro accepté, aucun pré-remplissage
  await text(page, "Commençons par estimer vos cartons");
  await text(page, "Pensez également aux petits objets et affaires personnelles de taille comparable à un carton");
  const boxes = page.locator("#extra-boxes");
  assert.equal(await boxes.inputValue(), "", "aucune valeur pré-remplie");
  assert.equal(await boxes.getAttribute("placeholder"), "10");
  await page.getByTestId("boxes-continue").click();
  await text(page, "Indiquez un nombre de cartons (0 si vous n'en avez pas besoin).");
  await boxes.fill("1,5");
  assert.equal(await boxes.inputValue(), "15", "virgule refusée");
  await text(page, "Chiffres uniquement");
  await boxes.fill("-3");
  assert.equal(await boxes.inputValue(), "3", "signe refusé");
  await boxes.fill("12");
  await shot(page, "m00-cartons");
  await page.getByTestId("boxes-continue").click();
  await page.getByTestId("room-scene").waitFor();
  await saved();
  assert.equal((await reqRow()).extra_boxes, 12);
  assert.deepEqual((await dbItems()).map((i) => [i.catalog_key, i.quantity, i.rooms.room_type]), [["carton-standard", 12, "inv:cartons"]]);
  log("Cartons (test E) : titre et texte demandés, champ vide (exemple « 10 » en gris), saisie obligatoire, texte/signe/virgule refusés, 12 cartons enregistrés (volume du carton standard du catalogue)");

  // 4D. Onglets des pièces et illustrations
  const tabs = await page.getByTestId("room-tab").allInnerTexts();
  assert.deepEqual(tabs, ["Salon", "Cuisine", "Chambre", "Salle de bain", "Bureau", "Entrée / couloir", "Garage / cave", "Autre pièce"]);
  const sceneObj = (key) => page.locator(`[data-testid=scene-object][data-catalog-key="${key}"]`).first();
  const row = (name) => page.getByTestId("room-list").getByTestId("inventory-item").filter({ hasText: name }).first();

  // Fluidité (test F) : délai entre l'appui et l'affichage, mesuré dans la page.
  const tapDelay = (key) => page.evaluate((k) => new Promise((resolve) => {
    const el = document.querySelector(`[data-testid=scene-object][data-catalog-key="${k}"]`);
    const before = document.querySelector("[data-testid=room-list]").textContent;
    const t0 = performance.now();
    const obs = new MutationObserver(() => {
      if (document.querySelector("[data-testid=room-list]").textContent !== before) { obs.disconnect(); resolve(performance.now() - t0); }
    });
    obs.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true });
    el.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  }), key);
  const delays = [await tapDelay("canape-3-places"), await tapDelay("canape-3-places"), await tapDelay("fauteuil")];
  assert.ok(delays.every((d) => d < 150), `affichage immédiat (${delays.map((d) => d.toFixed(0)).join(", ")} ms)`);
  assert.equal(await sceneObj("canape-3-places").getAttribute("data-selected"), "true");
  assert.match(await sceneObj("canape-3-places").evaluate((el) => el.textContent), /2$/, "quantité affichée sur le meuble");
  assert.equal(await row("Canapé 3 places").getByTestId("quantity-input").inputValue(), "2");
  await shot(page, "m01-salon");
  log(`Inventaire visuel (test D) : 8 pièces, illustration du salon, appui sur le canapé (×2) et le fauteuil ; affichage en ${delays.map((d) => d.toFixed(0)).join(" / ")} ms, sans attendre le serveur`);

  await page.getByTestId("room-tab").filter({ hasText: "Chambre" }).click();
  await sceneObj("armoire-2-portes").click();
  await page.getByTestId("room-catalog-toggle").click();
  await page.getByRole("button", { name: "Ajouter un Armoire 3 portes" }).click();
  await text(page, "quelle est sa taille, environ ?");
  await page.getByTestId("size-chooser").getByRole("button", { name: /^Grand/ }).click();
  await row("Armoire 3 portes").waitFor();
  await page.getByTestId("room-tab").filter({ hasText: "Cuisine" }).click();
  await page.getByTestId("catalog-search").fill("frigo");
  await page.getByRole("button", { name: /^Ajouter un Réfrigérateur$/ }).click();
  await row("Réfrigérateur").waitFor();
  await page.getByTestId("catalog-search").fill("");
  await page.getByTestId("room-tab").filter({ hasText: "Salle de bain" }).click();
  await sceneObj("meuble-vasque").click();
  await page.getByTestId("size-chooser").getByRole("button", { name: /^Moyen/ }).click();
  await row("Meuble sous-vasque").waitFor();
  // Pièce supplémentaire
  await page.getByTestId("add-room").click();
  await page.getByRole("button", { name: "Ajouter", exact: true }).click();
  await page.getByTestId("room-tab").filter({ hasText: "Chambre 2" }).waitFor();
  assert.equal(await page.getByTestId("room-panel").getAttribute("data-room").then((r) => r.startsWith("room:")), true);
  await sceneObj("lit-double").click();
  await row("Lit double").waitFor();
  // Objet non référencé dans le garage
  await page.getByTestId("room-tab").filter({ hasText: "Garage / cave" }).click();
  await page.getByTestId("custom-item-open").click();
  const form = page.getByTestId("custom-item-form");
  await form.getByRole("button", { name: "Ajouter cet objet" }).click();
  await text(page, "Indiquez une taille approximative ou les dimensions");
  await form.getByLabel("Nom de l'objet").fill("Statue en bronze");
  await form.getByText(/^Grand/).click();
  await form.getByLabel("Description").fill("Très lourde, socle démontable");
  await form.getByRole("button", { name: "Ajouter cet objet" }).click();
  await row("Statue en bronze").getByText("Objet à vérifier").waitFor();
  await shot(page, "m02-objet-a-verifier");
  // Les sélections des autres pièces sont conservées
  await page.getByTestId("room-tab").filter({ hasText: "Salon" }).click();
  assert.equal(await row("Canapé 3 places").getByTestId("quantity-input").inputValue(), "2");
  log("Pièces : illustration de la chambre, liste de la pièce (taille demandée pour une armoire sans volume de référence), recherche dans tout le catalogue, « Chambre 2 » ajoutée, objet non référencé « Objet à vérifier », sélections conservées d'un onglet à l'autre");

  // 4F. Saisie directe des quantités
  const qty = row("Canapé 3 places").getByTestId("quantity-input");
  await qty.click();
  await qty.fill("5");
  assert.equal(await qty.inputValue(), "5");
  await qty.fill("");
  await qty.press("Tab");
  assert.equal(await qty.inputValue(), "5", "champ vide : la valeur précédente est rétablie");
  await qty.fill("3,5");
  assert.equal(await qty.inputValue(), "35");
  await qty.fill("3");
  await qty.press("Enter");
  const fauteuil = row("Fauteuil").getByTestId("quantity-input");
  await fauteuil.fill("0");
  await fauteuil.press("Enter");
  await page.getByTestId("room-list").getByText("Fauteuil").waitFor({ state: "detached" });
  const boxQty = page.getByTestId("boxes-quantity");
  await boxQty.fill("20");
  await boxQty.press("Enter");
  // 3 × 1,5 + 0,8 + 0,8 (taille « grand ») + 0,4 + 0,5 (taille « moyen ») + 1,2 + 0,8 (taille « grand ») + 20 × 0,1 = 11 m³
  await page.waitForFunction(() => document.querySelector("[data-testid=inventory-volume]")?.textContent === "11 m³");
  await saved();
  const items = await dbItems();
  const byKey = Object.fromEntries(items.map((i) => [i.catalog_key ?? i.name, i]));
  assert.equal(byKey["canape-3-places"].quantity, 3);
  assert.equal(byKey["fauteuil"], undefined, "fauteuil retiré");
  assert.equal(byKey["carton-standard"].quantity, 20);
  assert.equal((await reqRow()).extra_boxes, 20);
  assert.equal(byKey["armoire-3-portes"].volume_source, "comparable");
  assert.match(byKey["armoire-3-portes"].volume_note, /comparable à « Armoire 2 portes »/);
  assert.equal(byKey["lit-double"].rooms.name, "Chambre 2");
  assert.match(byKey["lit-double"].rooms.room_type, /^inv:chambres:\d+$/);
  assert.equal(byKey["meuble-vasque"].rooms.name, "Salle de bain");
  assert.equal(byKey["Statue en bronze"].customer_comment, "Très lourde, socle démontable");
  assert.equal(byKey["Statue en bronze"].volume_source, "comparable");
  const sum = items.reduce((s, i) => s + i.quantity * Number(i.unit_volume_m3), 0);
  assert.equal(Math.round(sum * 100) / 100, 11, "volume affiché = volume enregistré");
  log("Quantités (test F) : saisie directe 5 puis 3, champ vide rétabli, virgule refusée, 0 retire l'objet, cartons passés à 20 ; total 11 m³ identique à la base ; chaque objet dans sa pièce (« Chambre 2 » comprise)");

  // Rechargement : tout est conservé, l'étape des cartons n'est plus redemandée
  await page.reload();
  await page.getByTestId("room-scene").waitFor();
  assert.equal(await page.getByTestId("inventory-volume").innerText(), "11 m³");
  assert.ok(await page.getByTestId("room-tab").filter({ hasText: "Chambre 2" }).isVisible());
  log("Rechargement de la page : inventaire, pièces et cartons conservés");
  await shot(page, "m03-inventaire");

  // 5. Récapitulatif, avertissement, envoi → devis immédiat
  await page.getByRole("button", { name: "Vérifier et continuer" }).click();
  await page.waitForURL(/recapitulatif$/);
  await text(page, "Inventaire (");
  const recapText = await page.locator("main").innerText();
  assert.ok(!/37[,.]00|37\s?€/.test(recapText), "prix de l'option jamais affiché au client");
  await page.getByLabel("Emballage de la vaisselle").check();
  await page.getByRole("button", { name: "Enregistrer mes options" }).click();
  await text(page, "Fourniture et emballage par nos soins");
  await page.waitForTimeout(800);
  await text(page, "Acme Conseil");
  await page.getByRole("button", { name: "Valider mon inventaire et recevoir mon devis" }).click();
  await text(page, "Confirmez avoir pris connaissance de l'avertissement");
  await page.getByLabel("J'ai pris connaissance de cet avertissement.").check();
  await shot(page, "m03-recapitulatif");
  await page.getByRole("button", { name: "Valider mon inventaire et recevoir mon devis" }).click();
  await page.waitForURL(/\/devis\/[0-9a-f]{64}$/, { timeout: 30000 });
  const quoteUrl = page.url();
  await text(page, "Prestations comprises", 30000);
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

  // 4G. Devis côté client : options et prestations sans prix détaillé, total seul (dans la page ET dans les données)
  const pageText = await page.locator("main").innerText();
  assert.ok(pageText.includes("Emballage de la vaisselle"), "option retenue affichée");
  assert.ok(!/37[,.]00\s?€/.test(pageText), "prix de l'option absent du devis client");
  const euroAmounts = pageText.match(/\d[\d\s ]*,\d{2}\s?€/g) ?? [];
  assert.ok(euroAmounts.length > 0, "le total reste affiché");
  assert.ok(await page.getByText("Inclus").first().isVisible(), "lignes « Inclus » sans montant");
  const anon = createClient(DB_URL, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
  const { data: view, error: viewError } = await anon.rpc("get_public_quote_view", { token: quoteUrl.split("/").pop() });
  assert.equal(viewError, null);
  const leaks = [];
  const scan = (v, where) => {
    if (Array.isArray(v)) return v.forEach((x, i) => scan(x, `${where}[${i}]`));
    if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) {
      if (/price|amount|unit_cents|per_m3|per_km|fee|cents/i.test(k) && !/^(upper_)?total_(ht|ttc)_cents$|^vat_cents$|^total_(before|after)_cents$|^prices_hidden$/.test(k)) leaks.push(`${where}.${k}`);
      scan(x, `${where}.${k}`);
    }
  };
  scan(view, "view");
  assert.deepEqual(leaks, [], `prix détaillés transmis au navigateur : ${leaks.join(", ")}`);
  assert.ok(view.quotes[0].lines.every((l) => Object.keys(l).sort().join() === "code,detail,label"), JSON.stringify(view.quotes[0].lines));
  const { data: proQuote } = await admin.from("quotes").select("lines").eq("request_id", req.id).single();
  assert.ok(proQuote.lines.every((l) => typeof l.amount_cents === "number"), "le déménageur garde le détail chiffré");
  assert.ok(proQuote.lines.some((l) => l.code === "option" && l.amount_cents === 3700), "option chiffrée 37,00 € côté pro");
  const pdfText = (await pdf.body()).toString("latin1");
  assert.ok(!pdfText.includes("37,00"), "prix de l'option absent du PDF client");
  log(`Devis (test G) : prestations listées « Inclus », total affiché ; aucune donnée de prix détaillé envoyée au navigateur (${view.quotes[0].lines.length} lignes vérifiées), détail conservé côté pro`);

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
    "Commentaire du client : « Très lourde, socle démontable »", "comparable à « Armoire 2 portes »", "Dossier de vérification", "Devis accepté par le client"]) {
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
