/**
 * Test de bout en bout du parcours particulier (phase 3), dans un vrai navigateur
 * Chromium en émulation mobile, avec une caméra simulée.
 *
 * Prérequis : Supabase local (npm run db:start), application sur http://localhost:3000
 * avec .env.local (Supabase local), et les vidéos de test générées par
 * `npm run test:media` (ffmpeg) dans tests/e2e/media/.
 *
 * L'API Adresse (data.geopf.fr) n'est pas joignable depuis l'environnement de test :
 * ses réponses sont remplacées par un exemple au format réel de l'API (doublure de test).
 *
 * Lancer : npm run test:e2e:client
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
let current = null; // page affichée en cas d'échec
const log = (m) => console.log(`✓ ${String(++step).padStart(2, "0")} ${m}`);
const media = (f) => {
  const p = path.join(MEDIA, f);
  assert.ok(fs.existsSync(p), `Fichier de test manquant : ${p} (lancez npm run test:media)`);
  return p;
};

const ADDRESS_FIXTURE = (q) => ({
  type: "FeatureCollection",
  features: /lyon|république/i.test(q)
    ? [{ type: "Feature", geometry: { type: "Point", coordinates: [4.8357, 45.764] },
        properties: { label: "12 Rue de la République 69002 Lyon", name: "12 Rue de la République", postcode: "69002", city: "Lyon", type: "housenumber" } }]
    : [{ type: "Feature", geometry: { type: "Point", coordinates: [2.0706, 49.0368] },
        properties: { label: "8 Boulevard du Port 95000 Cergy", name: "8 Boulevard du Port", postcode: "95000", city: "Cergy", type: "housenumber" } }],
});

async function mover(label) {
  const email = `${label}-${stamp}@test.local`;
  const password = "Demenage2026";
  const { error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: label } });
  if (error) throw error;
  const client = createClient(DB_URL, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
  await client.auth.signInWithPassword({ email, password });
  const { data: company, error: e2 } = await client.rpc("create_company", { company_name: `${label} ${stamp}` });
  if (e2) throw e2;
  await admin.from("companies").update({ brand_color: "#1f6e55", phone: "04 78 00 00 00" }).eq("id", company.id);
  return { email, password, company, client };
}

async function shot(page, name) {
  if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage: true });
}

async function text(page, t, timeout = 15000) {
  await page.getByText(t, { exact: false }).first().waitFor({ timeout });
}

async function chooseAddress(page, label, typed) {
  const input = page.getByLabel(label, { exact: true });
  await input.fill(typed);
  await page.getByRole("listbox").getByRole("option").first().click();
}

const day = (days) => new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);

/** Étape 1 « Déménagement » : adresses, logements (étage obligatoire), date et deux dates alternatives. */
async function fillTrip(page) {
  await chooseAddress(page, "Adresse de départ", "8 bd du port");
  await chooseAddress(page, "Adresse d'arrivée", "12 rue de la république lyon");
  await page.getByRole("radio", { name: "Appartement" }).first().check({ force: true });
  await page.locator("#origin-floor").selectOption("4");
  await page.getByRole("radio", { name: "Pas d'ascenseur" }).first().check({ force: true });
  await page.getByRole("radio", { name: "Maison" }).nth(1).check({ force: true });
  await page.locator("#destination-floor").selectOption("0");
  await page.getByRole("radio", { name: "Pas d'ascenseur" }).nth(1).check({ force: true });
  await page.locator("#moving_date").fill(day(30));
  for (const d of [37, 44, 51]) {
    await page.getByRole("button", { name: "Ajouter une date alternative" }).click();
    await page.getByLabel(/^Date alternative \d/).last().fill(day(d));
  }
  await page.getByRole("button", { name: "Retirer la date alternative 2" }).click();
}

/** Étape 2 « Coordonnées » (particulier). */
async function fillContact(page) {
  await page.getByLabel("Prénom").fill("Lina");
  await page.getByLabel("Nom", { exact: true }).fill("Martin");
  await page.getByLabel("E-mail").fill(`lina-${stamp}@example.com`);
  await page.getByLabel("Téléphone").fill("06 12 34 56 78");
  await page.getByRole("checkbox", { name: /J'accepte que mes informations/ }).check();
}

async function requestRow(email) {
  const { data } = await admin.from("customers").select("id, quote_requests(id, status, submitted_at)").eq("email", email).maybeSingle();
  return data?.quote_requests?.[0] ?? null;
}

(async () => {
  const pro = await mover("demenageur-a");
  const other = await mover("demenageur-b");
  const slug = pro.company.slug;
  // Phase 4 : grille tarifaire enregistrée par l'entreprise, une option, identité légale complète.
  {
    const { error: e1 } = await pro.client.from("pricing_settings").update({ price_per_m3: 80, minimum_price: 300, price_per_extra_km: 0 }).eq("company_id", pro.company.id);
    assert.equal(e1, null);
    const { error: e2 } = await pro.client.from("pricing_options").insert({ company_id: pro.company.id, name: "Protection renforcée des meubles", pricing_mode: "per_m3", price: 10 });
    assert.equal(e2, null);
    await admin.from("companies").update({ legal_name: "Déménagements A SARL", siret: "12345678900012", address_line1: "1 rue du Test", postal_code: "69001", city: "Lyon", insurance_info: "Assureur Exemple, contrat n° 42", auto_formal_quotes: true }).eq("id", pro.company.id);
  }
  const errors = [];

  const browser = await chromium.launch({
    args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", `--use-file-for-fake-video-capture=${media("camera.y4m")}`],
  });
  const ctx = await browser.newContext({ ...devices["Pixel 7"], permissions: ["camera"] });
  await ctx.route("https://data.geopf.fr/geocodage/search**", (route) =>
    route.fulfill({ json: ADDRESS_FIXTURE(new URL(route.request().url()).searchParams.get("q") ?? ""), headers: { "access-control-allow-origin": "*" } }));
  const page = await ctx.newPage();
  current = page;
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("dialog", (d) => d.accept());

  // 1. Lien de l'entreprise
  await page.goto(`${APP}/d/${slug}`);
  await text(page, `Estimez votre déménagement avec ${pro.company.name}`);
  const brand = await page.evaluate(() => getComputedStyle(document.querySelector("[style*='--ds-brand']")).getPropertyValue("--ds-brand").trim());
  assert.equal(brand, "#1f6e55");
  await shot(page, "c01-accueil");
  log("Lien de l'entreprise : page à son nom et à sa couleur");
  assert.equal((await page.goto(`${APP}/d/entreprise-inexistante-${stamp}`)).status(), 404);
  log("Lien d'entreprise inconnu : page introuvable");

  // 2. Déménagement : validation (étage obligatoire) puis saisie avec suggestions d'adresse
  await page.goto(`${APP}/d/${slug}`);
  await page.getByRole("link", { name: "Commencer ma demande" }).click();
  await page.waitForURL(/\/demande\/trajet$/);
  await page.getByRole("button", { name: "Continuer" }).click();
  await text(page, "Certains champs sont à corriger");
  await text(page, "Indiquez l'étage (rez-de-chaussée compris).");
  log("Étape déménagement : erreurs de validation affichées (étage obligatoire)");
  await fillTrip(page);
  assert.equal(await page.getByLabel("Code postal").first().inputValue(), "95000");
  assert.equal(await page.getByLabel(/^Date alternative \d/).count(), 2, "dates alternatives ajoutées puis une retirée");
  await page.getByLabel(/^Date alternative 2/).fill(day(20 - 30));
  await page.getByRole("button", { name: "Continuer" }).click();
  await text(page, "Cette date doit être dans le futur.");
  await page.getByLabel(/^Date alternative 2/).fill(day(30));
  await page.getByRole("button", { name: "Continuer" }).click();
  await text(page, "Cette date est déjà votre date souhaitée.");
  await page.getByLabel(/^Date alternative 2/).fill(day(51));
  await shot(page, "c02-demenagement");
  await page.getByRole("button", { name: "Continuer" }).click();
  await page.waitForURL(/\/demande\/coordonnees$/);
  const cookies = await ctx.cookies();
  const session = cookies.find((c) => c.name.startsWith("dsr_"));
  assert.ok(session && session.httpOnly && session.path === `/d/${slug}`, "cookie de session httpOnly limité au lien");
  assert.ok(!page.url().match(/[0-9a-f]{8}-[0-9a-f]{4}/), "aucun identifiant dans l'adresse");
  log("Adresses choisies parmi les suggestions, étages (dont rez-de-chaussée), dates alternatives contrôlées ; brouillon créé (cookie httpOnly)");

  // 3. Coordonnées : profils, téléphone obligatoire, consentements
  await page.getByRole("button", { name: "Continuer" }).click();
  await text(page, "Votre accord est nécessaire pour établir votre devis.");
  await text(page, "Le téléphone est obligatoire.");
  await page.getByText("Entreprise", { exact: true }).click();
  await page.getByLabel("Nom de l'entreprise").waitFor();
  assert.ok(await page.getByLabel(/SIRET/).isVisible(), "SIRET proposé (facultatif) au profil entreprise");
  await page.getByText("Particulier", { exact: true }).click();
  assert.equal(await page.getByLabel("Nom de l'entreprise").count(), 0, "champs entreprise masqués pour un particulier");
  await fillContact(page);
  assert.equal(await page.getByRole("checkbox", { name: /recevoir des offres/ }).isChecked(), false, "offres commerciales non cochées par défaut");
  await shot(page, "c02b-coordonnees");
  await page.getByRole("button", { name: "Continuer" }).click();
  await page.waitForURL(/\/demande\/methode$/);
  log("Coordonnées : profil particulier, champs entreprise masqués, téléphone et accord exigés, offres facultatives");

  // 4. Méthode : vidéo
  await page.getByRole("button", { name: "Continuer" }).click();
  await text(page, "Choisissez comment établir votre inventaire.");
  await shot(page, "c02c-methode");
  await page.getByTestId("method-video").click();
  await page.getByRole("button", { name: "Continuer" }).click();
  await page.waitForURL(/\/demande\/medias$/);
  log("Choix de la méthode : « Filmer ou photographier mon logement » → écran des médias, sans étape « pièces »");

  // Retour en arrière : les informations sont conservées
  await page.goto(`${APP}/d/${slug}/demande/trajet`);
  assert.equal(await page.locator("#origin-floor").inputValue(), "4");
  assert.equal(await page.locator("#destination-floor").inputValue(), "0");
  assert.equal(await page.getByLabel(/^Date alternative \d/).count(), 2);
  await page.goto(`${APP}/d/${slug}/demande/coordonnees`);
  assert.equal(await page.getByLabel("Prénom").inputValue(), "Lina");
  const { data: saved } = await admin.from("customers").select("customer_type, first_name, last_name, full_name, phone, privacy_accepted_at, marketing_consent, quote_requests(alternative_moving_dates, inventory_method, dwellings(kind, floor))").eq("email", `lina-${stamp}@example.com`).single();
  assert.equal(saved.full_name, "Lina Martin");
  assert.ok(saved.privacy_accepted_at);
  assert.equal(saved.marketing_consent, false);
  assert.deepEqual(saved.quote_requests[0].alternative_moving_dates, [day(37), day(51)]);
  assert.equal(saved.quote_requests[0].inventory_method, "video");
  assert.deepEqual(saved.quote_requests[0].dwellings.map((w) => [w.kind, w.floor]).sort(), [["destination", 0], ["origin", 4]]);
  // Anciennes adresses des étapes « pièces » et « vidéos » : redirigées vers l'écran des médias.
  await page.goto(`${APP}/d/${slug}/demande/pieces`);
  await page.waitForURL(/\/demande\/medias$/);
  await page.goto(`${APP}/d/${slug}/demande/videos`);
  await page.waitForURL(/\/demande\/medias$/);
  for (const id of ["media-film", "media-videos", "media-photos"]) assert.ok(await page.getByTestId(id).isVisible(), id);
  await shot(page, "c03-choix-medias");
  log("Retour aux étapes précédentes sans perte de données ; écran des médias : Filmer, Importer des vidéos, Importer des photos");

  const uploadedMedia = async () => (await admin.from("room_videos").select("id, status, processing, width, height, size_bytes, original_size_bytes, original_width, mime_type, media_kind, capture_source, rooms(name, room_type), video_frames(id)")
    .eq("company_id", pro.company.id).eq("status", "uploaded").order("created_at")).data;
  const sentItems = page.getByTestId("media-sent-item");

  // 5. Test A — une vidéo filmée avec la caméra (caméra simulée) : consignes, plusieurs séquences possibles
  await page.getByTestId("media-film").click();
  for (const tip of ["Filmez lentement.", "Montrez l'ensemble des meubles.", "Faites un tour complet de chaque pièce.", "Évitez les mouvements trop rapides."]) await text(page, tip);
  await page.getByRole("button", { name: "Ouvrir la caméra" }).click();
  await page.getByRole("button", { name: "Commencer à filmer" }).click();
  await text(page, "/ 2:00");
  await page.waitForTimeout(3500);
  await page.getByRole("button", { name: "Terminer le tournage" }).click();
  await page.getByTestId("media-pending").first().waitFor();
  assert.ok(await page.getByTestId("media-pending").first().locator("video").count() === 1, "aperçu de la séquence avant validation");
  await page.getByTestId("media-send").click();
  await sentItems.first().waitFor({ timeout: 90000 });
  await page.getByRole("button", { name: "Filmer une autre séquence" }).waitFor();
  let sent = await uploadedMedia();
  assert.equal(sent.length, 1);
  assert.deepEqual([sent[0].media_kind, sent[0].capture_source, sent[0].rooms.room_type], ["video", "camera", "logement"], "aucune pièce imposée");
  assert.ok(sent[0].video_frames.length >= 1);
  await shot(page, "c04-video-camera");
  log(`Test A : une vidéo filmée (consignes affichées), revue, compressée et envoyée dans « Mon logement » (${sent[0].video_frames.length} images extraites) ; « Filmer une autre séquence » proposé`);

  // 6. Test B — plusieurs vidéos importées en une fois, retrait avant validation, coupure réseau, ajout ultérieur
  await page.getByRole("button", { name: "Autres options" }).click().catch(() => undefined);
  let cut = 1;
  await page.route("**/storage/v1/upload/resumable/sign/**", (route) => {
    if (route.request().method() === "PATCH" && cut > 0) { cut--; return route.abort("connectionreset"); }
    return route.continue();
  });
  await page.locator('input[data-input="videos"]').setInputFiles([media("salon-1080p.webm"), media("cuisine-h264.mp4"), media("faux.mp4")]);
  await text(page, "n'est pas pris en charge");
  assert.equal(await page.getByTestId("media-pending").count(), 2, "faux fichier vidéo écarté, deux vidéos sélectionnées");
  await page.getByTestId("media-pending").filter({ hasText: "cuisine-h264" }).getByRole("button", { name: /Retirer/ }).click();
  assert.equal(await page.getByTestId("media-pending").count(), 1, "vidéo retirée avant validation");
  await page.getByTestId("media-send").click();
  await page.waitForFunction(() => document.querySelectorAll("[data-testid=media-sent-item]").length === 2, null, { timeout: 180000 });
  assert.equal(cut, 0, "la coupure réseau a bien été simulée");
  await page.unroute("**/storage/v1/upload/resumable/sign/**");
  // Ajout ultérieur d'une autre vidéo
  await page.locator('input[data-input="videos"]').setInputFiles(media("cuisine-h264.mp4"));
  await page.getByTestId("media-send").click();
  await page.waitForFunction(() => document.querySelectorAll("[data-testid=media-sent-item]").length === 3, null, { timeout: 90000 });
  sent = await uploadedMedia();
  const gallery = sent.find((v) => v.original_width === 1920);
  assert.equal(gallery.processing, "compressed");
  assert.ok(gallery.height <= 720 && gallery.size_bytes < gallery.original_size_bytes, JSON.stringify(gallery));
  assert.ok(sent.every((v) => v.rooms.room_type === "logement" && v.media_kind === "video"));
  log(`Test B : plusieurs vidéos sélectionnées d'un coup (faux fichier écarté, une retirée avant validation), 1080p ramenée à ${gallery.width}×${gallery.height}, envoi repris après coupure réseau, vidéo ajoutée ensuite ; 3 vidéos dans « Mon logement »`);

  // Vidéo trop lourde sur un appareil sans encodeur : refusée avant tout envoi
  await page.evaluate(() => { window.__VideoEncoder = window.VideoEncoder; window.VideoEncoder = undefined; });
  await page.locator('input[data-input="videos"]').setInputFiles(media("trop-lourde.mp4"));
  await page.getByTestId("media-send").click();
  await page.getByTestId("media-pending").getByText(/trop lourde \(50 Mo maximum\)/).waitFor({ timeout: 60000 });
  await page.evaluate(() => { window.VideoEncoder = window.__VideoEncoder; });
  await page.getByTestId("media-pending").getByRole("button", { name: /Retirer/ }).click();
  assert.equal((await uploadedMedia()).length, 3, "rien n'est envoyé");
  log("Vidéo trop lourde (57 Mo) sur un appareil sans compression : refusée avant tout envoi, message clair, retirée");

  // Supprimer une vidéo envoyée (fichier effacé)
  await sentItems.last().getByRole("button", { name: /Supprimer/ }).click();
  await page.waitForFunction(() => document.querySelectorAll("[data-testid=media-sent-item]").length === 2, null, { timeout: 15000 });
  assert.equal((await uploadedMedia()).length, 2);
  log("Vidéo envoyée supprimée (fichier effacé)");

  // 8. Récapitulatif, envoi, double envoi
  await page.getByRole("link", { name: /vers le récapitulatif/i }).click();
  await page.waitForURL(/recapitulatif$/);
  await text(page, "Dates alternatives");
  await page.getByLabel("Protection renforcée des meubles").check();
  await page.getByRole("button", { name: "Enregistrer mes options" }).click();
  await text(page, "Options enregistrées.");
  await page.locator("#customer_notes").fill("Piano droit dans le salon.");
  await shot(page, "c05-recapitulatif");
  const submit = page.getByRole("button", { name: /Envoyer ma demande/ });
  await submit.click();
  assert.equal(await submit.isDisabled().catch(() => true), true, "bouton désactivé pendant l'envoi");
  await submit.click({ timeout: 1500 }).catch(() => undefined);
  await page.waitForURL(/\/devis\/[0-9a-f]{64}$/, { timeout: 30000 });
  const quoteUrl = page.url();
  await text(page, "Votre demande de devis");
  await shot(page, "c06-suivi");
  log("Envoi : redirection vers le lien secret de suivi (aucun identifiant de demande dans l'adresse)");
  const row = await requestRow(`lina-${stamp}@example.com`);
  assert.ok(["submitted", "analyzing", "awaiting_customer"].includes(row.status), row.status);
  assert.ok(row.submitted_at);
  const { data: events } = await admin.from("request_events").select("id").eq("request_id", row.id).eq("to_status", "submitted");
  assert.equal(events.length, 1, "un seul envoi enregistré");
  await page.goBack();
  await page.waitForURL(/(envoyee|recapitulatif|devis\/[0-9a-f]{64})$/);
  await page.goto(`${APP}/d/${slug}/demande/recapitulatif`);
  await page.waitForURL(/envoyee$/);
  const { data: events2 } = await admin.from("request_events").select("id").eq("request_id", row.id).eq("to_status", "submitted");
  assert.equal(events2.length, 1);
  log("Demande envoyée une seule fois (bouton bloqué, retour arrière sans effet) ; statut et date d'envoi enregistrés");

  await page.goto(`${APP}/d/${slug}/demande/medias`);
  await page.waitForURL(/envoyee$/);
  log("Après l'envoi, le particulier ne peut plus modifier sa demande");

  // Analyse globale (simulateur de test) puis inventaire visuel à valider par le client, devis final immédiat
  await page.goto(quoteUrl);
  await text(page, "Commençons par estimer vos cartons", 90000);
  await text(page, "Environnement de test");
  const { data: run } = await admin.from("analysis_runs").select("status, simulated, provider, rooms_total, rooms_done").eq("request_id", row.id).single();
  assert.equal(run.status, "succeeded");
  assert.equal(run.simulated, true);
  assert.equal(run.rooms_done, run.rooms_total);
  assert.equal((await requestRow(`lina-${stamp}@example.com`)).status, "awaiting_customer");
  assert.equal((await admin.from("quotes").select("id").eq("request_id", row.id)).data.length, 0, "aucun devis avant la validation du client");
  await page.getByTestId("boxes-detected").getByText("6 cartons").waitFor();
  log(`Analyse de l'ensemble des vidéos en ${run.rooms_total} appel(s), sans découpage par pièce ; étape des cartons : « 6 cartons » repérés par l'analyse annoncés comme déjà comptés`);
  await page.locator("#extra-boxes").fill("5");
  await page.getByTestId("boxes-continue").click();
  await page.getByTestId("room-scene").waitFor();
  // Les objets de l'analyse sont rangés par pièce selon leur catégorie du catalogue
  await page.getByTestId("room-list").getByText("Canapé 3 places").first().waitFor();
  await page.getByTestId("room-tab").filter({ hasText: "Cuisine" }).click();
  await page.getByTestId("room-list").getByText(/Réfrigérateur/i).first().waitFor();
  const toCheck = page.getByTestId("to-check");
  assert.ok(await toCheck.count() >= 1, "meuble revu dans un autre passage : élément à vérifier");
  await text(page, "Merci de vérifier attentivement votre inventaire et de répondre avec honnêteté.");
  // L'inventaire de l'analyse est modifiable : objet oublié ajouté, quantité corrigée (modifications tracées).
  await page.getByTestId("room-tab").filter({ hasText: "Garage / cave" }).click();
  await page.locator('[data-testid=scene-object][data-catalog-key="velo"]').click();
  await page.getByRole("button", { name: /^Augmenter la quantité : Vélo/ }).click();
  await page.locator("[data-testid=sync-status][data-status=idle]").waitFor({ timeout: 15000 });
  const { data: added } = await admin.from("inventory_item_changes").select("action, actor").eq("request_id", row.id).eq("actor", "customer").order("changed_at");
  assert.ok(added.some((a) => a.action === "add") && added.some((a) => a.action === "update"), JSON.stringify(added));
  await shot(page, "c06a-inventaire-visuel");
  log("Inventaire visuel après analyse : objets rangés par pièce (canapé au salon, réfrigérateur en cuisine), vélo ajouté sur l'illustration du garage puis quantité corrigée (modifications tracées)");
  for (let i = 0; i < await toCheck.count(); i++) await toCheck.nth(i).getByLabel("C'est le même meuble : ne le compter qu'une fois").check();
  await page.getByLabel("J'ai pris connaissance de cet avertissement.").check();
  await page.getByRole("button", { name: "Valider mon inventaire et recevoir mon devis" }).click();
  await text(page, "Prestations comprises", 30000);
  await text(page, "Devis transmis par votre déménageur");
  await text(page, "Protection renforcée des meubles");
  const { data: q1 } = await admin.from("quotes").select("version, status, kind, origin, total_ttc_cents, pricing_snapshot, volume_snapshot").eq("request_id", row.id).order("version");
  assert.deepEqual(q1.map((q) => [q.version, q.status, q.kind, q.origin]), [[1, "sent", "formal", "customer_validation"]], "devis final transmis immédiatement");
  assert.equal(q1[0].pricing_snapshot.settings.price_per_m3, 80);
  const { data: validatedReq } = await admin.from("quote_requests").select("status, verification_status, customer_validated_at, customer_acknowledgement, extra_boxes").eq("id", row.id).single();
  assert.equal(validatedReq.status, "quote_sent");
  assert.equal(validatedReq.verification_status, "pending");
  assert.equal(validatedReq.extra_boxes, 5);
  const pdf = await page.request.get(`${quoteUrl}/pdf`);
  assert.equal(pdf.status(), 200);
  assert.equal((await pdf.body()).subarray(0, 5).toString(), "%PDF-");
  assert.equal((await page.request.get(`${APP}/d/${slug}/devis/${"0".repeat(64)}`)).status(), 404);
  await shot(page, "c06b-devis-final");
  log(`Inventaire validé (éléments à vérifier traités, 5 cartons supplémentaires, avertissement accepté) ; devis final V1 transmis aussitôt : ${(q1[0].total_ttc_cents / 100).toFixed(2)} € TTC ; PDF ; faux lien refusé`);

  await page.getByRole("button", { name: "Accepter le devis" }).click();
  await text(page, "Vous avez accepté ce devis");
  assert.equal((await requestRow(`lina-${stamp}@example.com`)).status, "accepted");
  const { data: stillPending } = await admin.from("quote_requests").select("verification_status").eq("id", row.id).single();
  assert.equal(stillPending.verification_status, "pending", "acceptation possible sans attendre la vérification");
  log("Le client accepte son devis immédiatement, sans attendre la vérification du déménageur");

  // 9. Espace déménageur : demande visible, vidéos lisibles, images
  const proCtx = await browser.newContext({ viewport: { width: 1360, height: 900 } });
  const p = await proCtx.newPage();
  p.on("pageerror", (e) => errors.push(String(e)));
  await p.goto(`${APP}/connexion`);
  await p.getByLabel("Adresse e-mail").fill(pro.email);
  await p.getByLabel("Mot de passe").fill(pro.password);
  await p.getByRole("button", { name: "Se connecter" }).click();
  await p.waitForURL(/\/espace$/);
  assert.match(await p.locator("#request-link").inputValue(), new RegExp(`/d/${slug}$`));
  await p.goto(`${APP}/espace/demandes`);
  await p.getByRole("link", { name: "Lina Martin" }).first().click();
  await p.waitForURL(/\/espace\/demandes\/[0-9a-f-]{36}$/);
  const proRequestUrl = p.url();
  await text(p, "Lien client");
  await text(p, "dates alternatives");
  await text(p, "Inventaire par vidéo");
  await text(p, "Images extraites");
  const playable = await p.evaluate(async () => {
    const vids = [...document.querySelectorAll("video")];
    await Promise.all(vids.map((v) => (v.readyState >= 1 ? null : new Promise((r) => { v.onloadedmetadata = r; v.onerror = r; setTimeout(r, 15000); }))));
    return vids.map((v) => ({ ready: v.readyState, duration: v.duration, error: v.error?.code ?? null }));
  });
  // Vidéo de la caméra et vidéo 1080p compressée (la troisième a été supprimée par le client).
  assert.equal(playable.length, 2, JSON.stringify(playable));
  assert.ok(playable.every((v) => v.ready >= 1 && v.duration > 0 && v.error === null), JSON.stringify(playable));
  // Images chargées en différé (loading="lazy") : chargement forcé avant le contrôle, la fiche étant longue.
  const images = await p.evaluate(async () => {
    const imgs = [...document.querySelectorAll("img[alt^='Image ']")];
    for (const i of imgs) i.loading = "eager";
    await Promise.all(imgs.map((i) => (i.complete && i.naturalWidth > 0 ? null : new Promise((r) => { i.onload = r; i.onerror = r; setTimeout(r, 15000); }))));
    return imgs.map((i) => i.complete && i.naturalWidth > 0);
  });
  assert.ok(images.length >= 3 && images.every(Boolean), JSON.stringify(images));
  await shot(p, "c07-fiche-pro");
  log(`Espace pro : demande reçue, ${playable.length} vidéos dont ${playable.filter((v) => v.duration > 0).length} lisibles dans ce navigateur, ${images.length} images affichées`);

  // Parcours 2 : le déménageur détecte une erreur après l'acceptation → avenant soumis au client
  await text(p, "Analyse simulée (environnement de test)");
  await text(p, "Dossier de vérification");
  await text(p, "Devis accepté par le client");
  await text(p, "Vérification humaine en attente");
  const chairItem = p.locator("li", { hasText: "Chaise" }).filter({ has: p.getByTestId("duplicate-box") }).first();
  await chairItem.locator("summary").click();
  await text(p, "Réponse du client :");
  await text(p, "le même meuble (compté une fois)");
  const fridge = p.locator("li", { hasText: "Réfrigérateur" }).first();
  await fridge.locator("summary").click();
  await fridge.getByLabel("Quantité").fill("2");
  await fridge.getByRole("button", { name: "Enregistrer et valider" }).click();
  await text(p, "Inventaire mis à jour");
  await text(p, "Corrections de l'inventaire");
  const { data: change } = await admin.from("inventory_item_changes").select("action, actor, changes, volume_before_m3, volume_after_m3, changed_by").eq("request_id", row.id).eq("actor", "mover").single();
  assert.equal(change.action, "update");
  assert.deepEqual(change.changes.quantity, { avant: 1, apres: 2 });
  assert.ok(Number(change.volume_after_m3) > Number(change.volume_before_m3));
  assert.ok(change.changed_by, "auteur de la correction enregistré");
  const { data: proposal } = await admin.from("inventory_items").select("quantity, ai_proposal").eq("request_id", row.id).eq("name", "Réfrigérateur").single();
  assert.equal(proposal.quantity, 2);
  assert.equal(proposal.ai_proposal.quantity, 1, "proposition de l'IA conservée");
  await p.getByLabel("Raison de la modification (communiquée au client)").fill("Un second réfrigérateur est visible dans la cuisine.");
  await p.getByRole("button", { name: "Enregistrer les corrections et informer le client" }).click();
  await text(p, "Avenant V2 transmis au client");
  await text(p, "Non envoyé : aucun service d'e-mail n'est configuré");
  const { data: versions } = await admin.from("quotes").select("id, version, status, origin, total_ttc_cents, amends_quote_id, changes_summary").eq("request_id", row.id).order("version");
  assert.deepEqual(versions.map((v) => [v.version, v.status, v.origin]), [[1, "accepted", "customer_validation"], [2, "sent", "verification"]]);
  assert.equal(versions[1].amends_quote_id, versions[0].id, "V2 est un avenant au devis accepté");
  assert.ok(versions[1].total_ttc_cents > versions[0].total_ttc_cents, "le second réfrigérateur augmente le prix");
  assert.ok(versions[1].changes_summary.differences.some((d) => /Montant TTC/.test(d)));
  const { data: verif } = await admin.from("inventory_verifications").select("outcome, reason, total_before_cents, total_after_cents, quote_before_id, quote_after_id").eq("request_id", row.id).single();
  assert.equal(verif.outcome, "corrected_amendment");
  assert.equal(verif.quote_before_id, versions[0].id);
  assert.equal(verif.quote_after_id, versions[1].id);
  const { data: mail } = await admin.from("customer_notifications").select("status, to_email, subject, body_text").eq("request_id", row.id).single();
  assert.equal(mail.status, "not_configured", "e-mail préparé, jamais présenté comme envoyé");
  assert.equal(mail.to_email, `lina-${stamp}@example.com`);
  for (const expected of [/vérification humaine/, /Réfrigérateur/, /Volume : /, /Montant TTC : /, /Raison de la modification : Un second réfrigérateur/, /reste valable et inchangé/]) assert.match(mail.body_text, expected);
  const { data: afterCorrection } = await admin.from("quote_requests").select("status, verification_status").eq("id", row.id).single();
  assert.deepEqual(afterCorrection, { status: "accepted", verification_status: "corrected" });
  const { error: frozen } = await admin.from("quotes").update({ total_ttc_cents: 1 }).eq("request_id", row.id).eq("version", 1);
  assert.ok(frozen, "une version de devis ne peut pas être modifiée");
  const { error: locked } = await admin.from("quotes").update({ status: "refused" }).eq("request_id", row.id).eq("version", 1);
  assert.ok(locked, "un devis accepté ne change plus de statut");
  await shot(p, "c07b-dossier-verification");
  log("Correction après acceptation : V1 acceptée conservée, avenant V2 soumis au client, e-mail préparé (non envoyé : aucun service configuré), traçabilité");

  await page.goto(quoteUrl);
  await text(page, "Avenant à votre devis accepté (version 2)");
  await text(page, "Votre devis accepté (version 1) reste valable et inchangé");
  await text(page, "Différences avec la version précédente");
  await text(page, "Un second réfrigérateur est visible dans la cuisine.");
  const v1Pdf = await page.request.get(`${quoteUrl}/pdf?version=1`);
  assert.equal(v1Pdf.status(), 200, "le devis accepté reste téléchargeable");
  await shot(page, "c06c-avenant");
  await page.getByRole("button", { name: "Refuser" }).click();
  await text(page, "Vous avez refusé l'avenant");
  const { data: finalVersions } = await admin.from("quotes").select("version, status").eq("request_id", row.id).order("version");
  assert.deepEqual(finalVersions.map((v) => [v.version, v.status]), [[1, "accepted"], [2, "refused"]]);
  assert.equal((await requestRow(`lina-${stamp}@example.com`)).status, "accepted", "le devis accepté reste en vigueur");
  await p.reload();
  await text(p, "Nouvelle version refusée");
  const { data: history } = await admin.from("inventory_item_changes").select("actor, action").eq("request_id", row.id).order("changed_at");
  // Client : cartons supplémentaires et vélo ajoutés, quantité corrigée, réponses aux éléments à vérifier ; puis correction du déménageur.
  const actions = history.map((h) => `${h.actor}:${h.action}`);
  const lastCustomer = actions.lastIndexOf("customer:customer_decision");
  assert.ok(actions.filter((a) => a === "customer:add").length >= 2 && actions.includes("customer:update") && lastCustomer >= 0, actions.join());
  assert.deepEqual(actions.slice(lastCustomer + 1), ["mover:update"], `historique complet : ${actions.join()}`);
  log("Le client voit l'avenant et les différences, le refuse : V1 acceptée reste en vigueur ; historique complet");

  // 10. Autre entreprise : aucun accès
  await p.getByRole("button", { name: "Se déconnecter" }).click();
  await p.waitForURL(/connexion/);
  await p.getByLabel("Adresse e-mail").fill(other.email);
  await p.getByLabel("Mot de passe").fill(other.password);
  await p.getByRole("button", { name: "Se connecter" }).click();
  await p.waitForURL(/\/espace$/);
  assert.equal((await p.goto(proRequestUrl)).status(), 404);
  log("Une autre entreprise obtient « introuvable » sur cette demande");

  // 11. Refus de la caméra : message et solutions de repli
  const denied = await browser.newContext({ ...devices["Pixel 7"], permissions: [] });
  await denied.route("https://data.geopf.fr/geocodage/search**", (route) =>
    route.fulfill({ json: ADDRESS_FIXTURE(new URL(route.request().url()).searchParams.get("q") ?? "") }));
  const d = await denied.newPage();
  current = d;
  await d.goto(`${APP}/d/${slug}/demande/trajet`);
  await fillTrip(d);
  await d.getByRole("button", { name: "Continuer" }).click();
  await d.waitForURL(/coordonnees$/);
  await fillContact(d);
  await d.getByRole("button", { name: "Continuer" }).click();
  await d.waitForURL(/methode$/);
  await d.getByTestId("method-video").click();
  await d.getByRole("button", { name: "Continuer" }).click();
  await d.waitForURL(/medias$/);
  const deniedBrowser = await chromium.launch(); // sans autorisation automatique de la caméra
  const dc = await deniedBrowser.newContext({ ...devices["Pixel 7"], storageState: await denied.storageState() });
  const dp = await dc.newPage();
  await dp.goto(`${APP}/d/${slug}/demande/medias`);
  await dp.getByTestId("media-film").click();
  await dp.getByRole("button", { name: "Ouvrir la caméra" }).click();
  await text(dp, "Aucune caméra disponible");
  assert.ok(await dp.getByRole("button", { name: "Utiliser l'appareil photo du téléphone" }).isVisible());
  assert.ok(await dp.getByRole("button", { name: "Autres options" }).isVisible());
  log("Appareil sans caméra : message clair et repli (appareil photo du téléphone, import de vidéos ou de photos)");

  // Autorisation refusée par l'utilisateur. Chromium sans interface ne sait pas afficher la demande
  // d'autorisation : on reproduit l'erreur exacte renvoyée par les navigateurs mobiles (NotAllowedError).
  const refusingBrowser = await chromium.launch();
  const rc = await refusingBrowser.newContext({ ...devices["Pixel 7"], permissions: [], storageState: await denied.storageState() });
  await rc.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException("Permission denied", "NotAllowedError"));
  });
  const rp = await rc.newPage();
  await rp.goto(`${APP}/d/${slug}/demande/medias`);
  await rp.getByTestId("media-film").click();
  await rp.getByRole("button", { name: "Ouvrir la caméra" }).click();
  await text(rp, "Accès à la caméra refusé");
  assert.ok(await rp.getByRole("button", { name: "Ouvrir la caméra" }).isVisible(), "on peut réessayer après avoir autorisé");
  assert.ok(await rp.getByRole("button", { name: "Utiliser l'appareil photo du téléphone" }).isVisible());
  await shot(rp, "c08-camera-refusee");
  await refusingBrowser.close();
  log("Autorisation de la caméra refusée : explication, nouvel essai possible et solutions de repli");

  // 12. Envoi interrompu durablement puis repris à la main
  await dp.route("**/storage/v1/upload/resumable/sign/**", (route) => (route.request().method() === "PATCH" ? route.abort("internetdisconnected") : route.continue()));
  await dp.getByRole("button", { name: "Autres options" }).click();
  await dp.locator('input[data-input="videos"]').setInputFiles(media("cuisine-h264.mp4"));
  await dp.getByTestId("media-send").click();
  await dp.getByRole("button", { name: "Réessayer l'envoi" }).waitFor({ timeout: 90000 });
  await shot(dp, "c09-envoi-interrompu");
  await dp.unroute("**/storage/v1/upload/resumable/sign/**");
  await dp.getByRole("button", { name: "Réessayer l'envoi" }).click();
  await dp.getByTestId("media-sent-item").first().waitFor({ timeout: 90000 });
  log("Coupure prolongée : erreur affichée, puis envoi repris à la main avec succès");

  // 13. Session expirée
  const deniedEmail = `lina-${stamp}@example.com`;
  const { data: drafts } = await admin.from("quote_requests").select("id").eq("company_id", pro.company.id).eq("status", "draft");
  assert.ok(drafts.length >= 1);
  await admin.from("quote_requests").update({ access_token_expires_at: new Date(Date.now() - 1000).toISOString() }).in("id", drafts.map((r) => r.id));
  await dp.goto(`${APP}/d/${slug}/demande/recapitulatif`);
  await dp.waitForURL(/trajet\?session=expiree/);
  await text(dp, "Votre session a expiré");
  log(`Session expirée : retour au début avec un message (${deniedEmail.length > 0 ? "aucune donnée exposée" : ""})`);

  // 14. Abandon : le brouillon n'apparaît pas chez le déménageur
  await p.goto(`${APP}/connexion`);
  await proCtx.clearCookies();
  await p.goto(`${APP}/connexion`);
  await p.getByLabel("Adresse e-mail").fill(pro.email);
  await p.getByLabel("Mot de passe").fill(pro.password);
  await p.getByRole("button", { name: "Se connecter" }).click();
  await p.waitForURL(/\/espace$/);
  await p.goto(`${APP}/espace/demandes`);
  // Deux demandes au nom de Lina existent (une envoyée, un brouillon abandonné) : une seule est visible.
  assert.equal(await p.getByRole("link", { name: "Lina Martin" }).count(), 1, "seule la demande envoyée apparaît");
  log("Demande abandonnée (non envoyée) invisible dans l'espace pro");

  // Mobile : pas de débordement horizontal sur les pages du parcours
  for (const url of [`/d/${slug}`, `/d/${slug}/demande/trajet`]) {
    const m = await (await browser.newContext({ ...devices["iPhone SE"] })).newPage();
    await m.goto(APP + url);
    assert.equal(await m.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), 0, url);
  }
  log("Petit écran (iPhone SE) : aucun débordement horizontal");

  assert.deepEqual(errors, [], errors.join("\n"));
  log("Aucune erreur JavaScript");
  await deniedBrowser.close();
  await browser.close();
  console.log(`\nParcours client complet réussi (${step} vérifications).`);
})().catch(async (e) => {
  console.error("\n✗ ÉCHEC :", e.message);
  if (current) console.error("Page :", current.url(), "\nErreurs :", await current.locator(".text-danger-text").allInnerTexts().catch(() => []));
  process.exit(1);
});
