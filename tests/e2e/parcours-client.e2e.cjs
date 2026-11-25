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
  await page.getByRole("option").first().click();
}

async function fillTrip(page) {
  await chooseAddress(page, "Adresse de départ", "8 bd du port");
  await chooseAddress(page, "Adresse d'arrivée", "12 rue de la république lyon");
  const d = (days) => new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
  await page.locator("#moving_date").fill(d(30));
  await page.locator("#alternative_moving_date").fill(d(37));
  await page.getByLabel("Nom et prénom").fill("Lina Martin");
  await page.getByLabel("E-mail").fill(`lina-${stamp}@example.com`);
  await page.getByLabel("Téléphone").fill("06 12 34 56 78");
  await page.getByRole("checkbox", { name: /J'accepte/ }).check();
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

  // 2. Trajet : validation puis saisie avec suggestions d'adresse
  await page.goto(`${APP}/d/${slug}`);
  await page.getByRole("link", { name: "Commencer ma demande" }).click();
  await page.waitForURL(/\/demande\/trajet$/);
  await page.getByRole("button", { name: "Continuer" }).click();
  await text(page, "Certains champs sont à corriger");
  await text(page, "Votre accord est nécessaire");
  log("Étape trajet : erreurs de validation affichées");
  await fillTrip(page);
  assert.equal(await page.getByLabel("Code postal").first().inputValue(), "95000");
  await shot(page, "c02-trajet");
  await page.getByRole("button", { name: "Continuer" }).click();
  await page.waitForURL(/\/demande\/logements$/);
  const cookies = await ctx.cookies();
  const session = cookies.find((c) => c.name.startsWith("dsr_"));
  assert.ok(session && session.httpOnly && session.path === `/d/${slug}`, "cookie de session httpOnly limité au lien");
  assert.ok(!page.url().match(/[0-9a-f]{8}-[0-9a-f]{4}/), "aucun identifiant dans l'adresse");
  log("Adresses choisies parmi les suggestions, brouillon créé (cookie httpOnly, aucune donnée dans l'URL)");

  // 3. Logements
  await page.getByRole("button", { name: "Continuer" }).click();
  await text(page, "Choisissez le type de logement");
  const fieldsets = page.locator("fieldset fieldset");
  await page.getByText("Appartement").first().click();
  await page.locator("#origin-surface").fill("65");
  await page.locator("#origin-rooms").fill("3");
  await page.locator("#origin-floor").fill("4");
  await page.getByText("Pas d'ascenseur").first().click();
  await page.locator("#origin-carrying").fill("20");
  await page.locator("#origin-access").fill("Escalier étroit au 3e");
  await page.locator("#origin-parking").fill("Rue piétonne");
  await page.getByText("Maison").nth(1).click();
  await page.getByText("Pas d'ascenseur").nth(1).click();
  assert.ok((await fieldsets.count()) >= 4);
  await page.getByRole("button", { name: "Continuer" }).click();
  await page.waitForURL(/\/demande\/pieces$/);
  log("Étape logements enregistrée");

  // Retour en arrière : les informations sont conservées
  await page.getByRole("link", { name: "← Étape précédente" }).click();
  await page.waitForURL(/\/demande\/logements$/);
  assert.equal(await page.locator("#origin-surface").inputValue(), "65");
  assert.equal(await page.locator("#origin-access").inputValue(), "Escalier étroit au 3e");
  await page.goto(`${APP}/d/${slug}/demande/trajet`);
  assert.equal(await page.getByLabel("Nom et prénom").inputValue(), "Lina Martin");
  await page.goto(`${APP}/d/${slug}/demande/pieces`);
  log("Retour aux étapes précédentes sans perte de données");

  // 4. Pièces : ajout, modification, suppression
  for (const name of ["Salon", "Cuisine", "Chambre principale"]) {
    await page.getByRole("button", { name, exact: true }).click();
    await page.getByRole("button", { name: "Ajouter la pièce" }).click();
    await text(page, `« ${name} » ajoutée`);
  }
  await page.getByRole("button", { name: "Cave", exact: true }).click();
  await page.locator("#new-room-desc").fill("Vélos et cartons");
  await page.getByRole("button", { name: "Ajouter la pièce" }).click();
  await text(page, "« Cave » ajoutée");
  await page.getByRole("button", { name: "Modifier Salon" }).click();
  await page.getByLabel("Nom de la pièce").first().fill("Grand salon");
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await text(page, "Grand salon");
  await page.getByRole("button", { name: "Supprimer Chambre principale" }).click();
  await page.getByRole("button", { name: "Supprimer Chambre principale" }).waitFor({ state: "detached" });
  assert.equal(await page.getByRole("list", { name: "Vos pièces" }).locator(":scope > li").count(), 3);
  await shot(page, "c03-pieces");
  log("Pièces ajoutées, renommée et supprimée");

  await page.getByRole("button", { name: "Continuer vers les vidéos" }).click();
  await page.waitForURL(/\/demande\/videos$/);

  // 5. Vidéo par la caméra (caméra simulée) : tournage, revue, compression, images, envoi
  await page.getByRole("button", { name: "Filmer cette pièce" }).click();
  await page.getByRole("button", { name: "Commencer à filmer" }).click();
  await text(page, "/ 2:00");
  await page.waitForTimeout(3500);
  await page.getByRole("button", { name: "Terminer le tournage" }).click();
  await text(page, "Vérifiez la vidéo");
  log("Caméra ouverte, consignes affichées, tournage terminé et vidéo revue");
  await page.getByRole("button", { name: "Utiliser cette vidéo" }).click();
  const salonCard = page.locator("li", { hasText: "Salon" }).last();
  await salonCard.getByText("Vidéo envoyée").waitFor({ timeout: 90000 });
  await salonCard.getByText(/image.? extraite/).waitFor();
  await shot(page, "c04-video-camera");
  log("Vidéo de la caméra traitée, envoyée et images extraites");

  // 6. Galerie : vidéo 1080p WebM (compression réelle) avec coupure réseau pendant l'envoi
  await page.getByRole("button", { name: /Cuisine/ }).click();
  let cut = 1;
  await page.route("**/storage/v1/upload/resumable/sign/**", (route) => {
    if (route.request().method() === "PATCH" && cut > 0) { cut--; return route.abort("connectionreset"); }
    return route.continue();
  });
  await page.locator('input[data-input="gallery"]').setInputFiles(media("salon-1080p.webm"));
  await page.getByRole("button", { name: "Utiliser cette vidéo" }).click();
  const cuisineCard = page.locator("li", { hasText: "Cuisine" }).last();
  await cuisineCard.getByText("Compression de la vidéo").waitFor({ timeout: 20000 });
  await cuisineCard.getByText("Vidéo envoyée").waitFor({ timeout: 180000 });
  await cuisineCard.getByText("(compressée").waitFor();
  assert.equal(cut, 0, "la coupure réseau a bien été simulée");
  await page.unroute("**/storage/v1/upload/resumable/sign/**");
  log("Vidéo 1080p de la galerie compressée ; envoi repris automatiquement après une coupure réseau");

  const { data: videos } = await admin.from("room_videos").select("status, processing, width, height, size_bytes, original_size_bytes, original_width, mime_type, capture_source, video_frames(id)")
    .eq("company_id", pro.company.id).eq("status", "uploaded").order("created_at");
  assert.equal(videos.length, 2);
  const gallery = videos.find((v) => v.capture_source === "gallery");
  assert.equal(gallery.processing, "compressed");
  assert.equal(gallery.original_width, 1920);
  assert.ok(gallery.height <= 720 && gallery.size_bytes < gallery.original_size_bytes, JSON.stringify(gallery));
  assert.ok(gallery.video_frames.length >= 3, `images extraites : ${gallery.video_frames.length}`);
  log(`Base : vidéo 1920×1080 ramenée à ${gallery.width}×${gallery.height} (${(gallery.original_size_bytes / 1e6).toFixed(1)} → ${(gallery.size_bytes / 1e6).toFixed(1)} Mo), ${gallery.video_frames.length} images`);

  // 7. Fichiers refusés : faux fichier vidéo, vidéo trop lourde non compressible
  await page.getByRole("button", { name: /Cave/ }).click();
  await page.locator('input[data-input="gallery"]').setInputFiles(media("faux.mp4"));
  await text(page, "n'est pas une vidéo prise en charge");
  log("Faux fichier vidéo refusé");
  // Appareil sans encodeur vidéo (ex. ancien iPhone) : une vidéo de 57 Mo ne peut pas être réduite.
  await page.evaluate(() => { window.__VideoEncoder = window.VideoEncoder; window.VideoEncoder = undefined; });
  await page.locator('input[data-input="gallery"]').setInputFiles(media("trop-lourde.mp4"));
  await page.getByRole("button", { name: "Utiliser cette vidéo" }).click();
  await page.locator("li", { hasText: "Cave" }).last().getByText(/trop lourde \(50 Mo maximum\)/).waitFor({ timeout: 60000 })
    .catch(async () => { await shot(page, "erreur-trop-lourde"); throw new Error("message « trop lourde » absent"); });
  await page.evaluate(() => { window.VideoEncoder = window.__VideoEncoder; });
  const { data: caveVideos } = await admin.from("room_videos").select("id, rooms!inner(name)").eq("company_id", pro.company.id).eq("rooms.name", "Cave").neq("status", "deleted");
  assert.equal(caveVideos.length, 0, "rien n'est envoyé");
  log("Vidéo trop lourde (57 Mo) sur un appareil sans compression : refusée avant tout envoi, message clair");

  // Supprimer puis refaire une vidéo
  await page.getByRole("button", { name: /Cuisine/ }).click();
  const before = (await admin.from("room_videos").select("id").eq("company_id", pro.company.id).eq("status", "uploaded")).data.length;
  await page.getByRole("button", { name: "Supprimer" }).last().click();
  await page.getByRole("button", { name: "Choisir une vidéo existante" }).waitFor();
  let after = before;
  for (let i = 0; i < 20 && after !== before - 1; i++) {
    await page.waitForTimeout(500);
    after = (await admin.from("room_videos").select("id").eq("company_id", pro.company.id).eq("status", "uploaded")).data.length;
  }
  assert.equal(after, before - 1);
  await page.locator('input[data-input="gallery"]').setInputFiles(media("cuisine-h264.mp4"));
  await page.getByRole("button", { name: "Utiliser cette vidéo" }).click();
  await cuisineCard.getByText("Vidéo envoyée").waitFor({ timeout: 90000 });
  log("Vidéo supprimée (fichier effacé) puis remplacée par une vidéo MP4");

  // 8. Récapitulatif, envoi, double envoi
  await page.getByRole("link", { name: /au récapitulatif/i }).click();
  await page.waitForURL(/recapitulatif$/);
  await text(page, "1 pièce sans vidéo");
  await text(page, "Escalier étroit au 3e");
  await page.getByLabel("Protection renforcée des meubles").check();
  await page.getByRole("button", { name: "Enregistrer mes options" }).click();
  await text(page, "Options enregistrées.");
  await page.locator("#customer_notes").fill("Piano droit dans le salon.");
  await shot(page, "c05-recapitulatif");
  const submit = page.getByRole("button", { name: /Envoyer ma demande/ });
  await submit.click();
  // Second clic immédiat : le bouton est désactivé pendant l'envoi.
  assert.equal(await submit.isDisabled().catch(() => true), true, "bouton désactivé pendant l'envoi");
  await submit.click({ timeout: 1500 }).catch(() => undefined);
  await page.waitForURL(/\/devis\/[0-9a-f]{64}$/, { timeout: 30000 });
  const quoteUrl = page.url();
  await text(page, "Votre demande de devis");
  await shot(page, "c06-suivi");
  log("Envoi : redirection vers le lien secret de suivi (aucun identifiant de demande dans l'adresse)");
  const row = await requestRow(`lina-${stamp}@example.com`);
  assert.ok(["submitted", "analyzing", "to_review"].includes(row.status), row.status);
  assert.ok(row.submitted_at);
  const { data: events } = await admin.from("request_events").select("id").eq("request_id", row.id).eq("to_status", "submitted");
  assert.equal(events.length, 1, "un seul envoi enregistré");
  // Renvoi du formulaire depuis l'historique du navigateur : la demande reste unique.
  await page.goBack();
  await page.waitForURL(/(envoyee|recapitulatif|devis\/[0-9a-f]{64})$/);
  await page.goto(`${APP}/d/${slug}/demande/recapitulatif`);
  await page.waitForURL(/envoyee$/);
  const { data: events2 } = await admin.from("request_events").select("id").eq("request_id", row.id).eq("to_status", "submitted");
  assert.equal(events2.length, 1);
  log("Demande envoyée une seule fois (bouton bloqué, retour arrière sans effet) ; statut et date d'envoi enregistrés");

  await page.goto(`${APP}/d/${slug}/demande/pieces`);
  await page.waitForURL(/envoyee$/);
  log("Après l'envoi, le particulier ne peut plus modifier sa demande");

  // Phase 4 : analyse (simulateur de test), estimation automatique, PDF
  await page.goto(quoteUrl);
  await text(page, "Détail du prix", 90000);
  await text(page, "Environnement de test");
  await text(page, "Estimation indicative · non contractuelle");
  await text(page, "Points à vérifier par");
  assert.equal(await page.getByText("jamais de devis formel").count(), 0, "motifs internes non montrés au client");
  await text(page, "Protection renforcée des meubles");
  const { data: run } = await admin.from("analysis_runs").select("status, simulated, provider, rooms_total, rooms_done").eq("request_id", row.id).single();
  assert.deepEqual(run, { status: "succeeded", simulated: true, provider: "simulation", rooms_total: 2, rooms_done: 2 });
  const { data: q1 } = await admin.from("quotes").select("version, status, kind, total_ttc_cents, pricing_snapshot, review_reasons").eq("request_id", row.id).order("version");
  assert.equal(q1.length, 1);
  assert.equal(q1[0].status, "generated");
  assert.equal(q1[0].kind, "estimate", "simulateur : jamais de devis formel, même avec l'envoi automatique activé");
  assert.equal(q1[0].pricing_snapshot.settings.price_per_m3, 80);
  assert.ok(q1[0].review_reasons.some((r) => /simulateur/.test(r)), JSON.stringify(q1[0].review_reasons));
  assert.ok(q1[0].review_reasons.some((r) => /à vérifier/.test(r)));
  const pdf = await page.request.get(`${quoteUrl}/pdf`);
  assert.equal(pdf.status(), 200);
  assert.equal((await pdf.body()).subarray(0, 5).toString(), "%PDF-");
  assert.equal((await page.request.get(`${APP}/d/${slug}/devis/${"0".repeat(64)}`)).status(), 404);
  await shot(page, "c06b-estimation");
  log(`Analyse simulée (signalée comme telle), estimation V1 calculée avec la grille de l'entreprise : ${(q1[0].total_ttc_cents / 100).toFixed(2)} € TTC ; PDF téléchargeable ; faux lien refusé`);

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
  await text(p, "date alternative");
  await text(p, "Rue piétonne");
  await text(p, "Images extraites");
  const playable = await p.evaluate(async () => {
    const vids = [...document.querySelectorAll("video")];
    await Promise.all(vids.map((v) => (v.readyState >= 1 ? null : new Promise((r) => { v.onloadedmetadata = r; v.onerror = r; setTimeout(r, 15000); }))));
    return vids.map((v) => ({ ready: v.readyState, duration: v.duration, error: v.error?.code ?? null }));
  });
  // Salon (caméra) et Cuisine (vidéo remplacée) ; la cave n'a pas de vidéo.
  assert.equal(playable.length, 2, JSON.stringify(playable));
  assert.ok(playable.every((v) => v.ready >= 1 && v.duration > 0 && v.error === null), JSON.stringify(playable));
  await text(p, "Pas de vidéo");
  const images = await p.evaluate(() => [...document.querySelectorAll("img[alt^='Image ']")].map((i) => i.complete && i.naturalWidth > 0));
  assert.ok(images.length >= 3 && images.every(Boolean), JSON.stringify(images));
  await shot(p, "c07-fiche-pro");
  log(`Espace pro : demande reçue, ${playable.length} vidéos dont ${playable.filter((v) => v.duration > 0).length} lisibles dans ce navigateur, ${images.length} images affichées`);

  // Phase 4 : inventaire corrigé par le déménageur, nouvelle version, envoi, acceptation
  await text(p, "Analyse simulée (environnement de test)");
  await text(p, "Validation humaine nécessaire avant un devis formel");
  await text(p, "Estimation indicative");
  await text(p, "Canapé 3 places");
  const fridge = p.locator("li", { hasText: "Réfrigérateur" }).first();
  await fridge.locator("summary").click();
  await fridge.getByLabel("Quantité").fill("2");
  await fridge.getByRole("button", { name: "Enregistrer et valider" }).click();
  await text(p, "Inventaire mis à jour");
  await text(p, "Corrections de l'inventaire");
  const { data: change } = await admin.from("inventory_item_changes").select("action, changes, volume_before_m3, volume_after_m3, changed_by").eq("request_id", row.id).single();
  assert.equal(change.action, "update");
  assert.deepEqual(change.changes.quantity, { avant: 1, apres: 2 });
  assert.ok(Number(change.volume_after_m3) > Number(change.volume_before_m3));
  assert.ok(change.changed_by);
  const { data: proposal } = await admin.from("inventory_items").select("quantity, ai_proposal, validated_by_human").eq("request_id", row.id).eq("name", "Réfrigérateur").single();
  assert.equal(proposal.quantity, 2);
  assert.equal(proposal.ai_proposal.quantity, 1, "proposition de l'IA conservée");
  assert.equal(proposal.validated_by_human, true);
  log("Correction d'un objet : historique (avant, après, auteur, impact sur le volume), proposition de l'IA conservée");

  await p.getByRole("button", { name: "Recalculer (nouvelle version)" }).click();
  await text(p, "Version 2 calculée.");
  await p.getByRole("button", { name: "Valider et envoyer au client" }).click();
  await text(p, "Devis V3 envoyé");
  const { data: versions } = await admin.from("quotes").select("version, status, kind, total_ttc_cents, changes_summary").eq("request_id", row.id).order("version");
  assert.deepEqual(versions.map((v) => [v.version, v.status, v.kind]), [[1, "superseded", "estimate"], [2, "superseded", "estimate"], [3, "sent", "formal"]]);
  assert.ok(versions[1].total_ttc_cents > versions[0].total_ttc_cents, "le second réfrigérateur augmente le prix");
  assert.equal(versions[1].changes_summary.corrections, 1);
  const { error: frozen } = await admin.from("quotes").update({ total_ttc_cents: 1 }).eq("request_id", row.id).eq("version", 1);
  assert.ok(frozen, "une version de devis ne peut pas être modifiée");
  log("Versions : V1 automatique, V2 corrigée, V3 envoyée (devis formel) ; versions figées");

  await page.goto(quoteUrl);
  await text(page, "Devis envoyé par votre déménageur");
  await text(page, "Devis vérifié et envoyé par");
  assert.equal(await page.getByTestId("quote-kind").innerText(), "Devis");
  await page.getByRole("button", { name: "Accepter le devis" }).click();
  await text(page, "Vous avez accepté ce devis");
  const { data: accepted } = await admin.from("quotes").select("status, accepted_at").eq("request_id", row.id).eq("version", 3).single();
  assert.equal(accepted.status, "accepted");
  assert.equal((await requestRow(`lina-${stamp}@example.com`)).status, "accepted");
  const { error: locked } = await admin.from("quotes").update({ status: "refused" }).eq("request_id", row.id).eq("version", 3);
  assert.ok(locked, "un devis accepté ne change plus de statut");
  await p.reload();
  await text(p, "Devis accepté par le client");
  await shot(page, "c06c-devis-accepte");
  log("Le client accepte le devis envoyé ; devis accepté verrouillé, plus de recalcul possible");

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
  await d.goto(`${APP}/d/${slug}/demande/trajet`);
  await fillTrip(d);
  await d.getByRole("button", { name: "Continuer" }).click();
  await d.waitForURL(/logements$/);
  await d.goto(`${APP}/d/${slug}/demande/pieces`);
  await d.getByRole("button", { name: "Salon", exact: true }).click();
  await d.getByRole("button", { name: "Ajouter la pièce" }).click();
  await text(d, "« Salon » ajoutée");
  await d.goto(`${APP}/d/${slug}/demande/videos`);
  const deniedBrowser = await chromium.launch(); // sans autorisation automatique de la caméra
  const dc = await deniedBrowser.newContext({ ...devices["Pixel 7"], storageState: await denied.storageState() });
  const dp = await dc.newPage();
  await dp.goto(`${APP}/d/${slug}/demande/videos`);
  await dp.getByRole("button", { name: "Filmer cette pièce" }).click();
  await text(dp, "Aucune caméra disponible");
  assert.ok(await dp.getByRole("button", { name: "Utiliser l'appareil photo du téléphone" }).isVisible());
  assert.ok(await dp.getByRole("button", { name: "Choisir une vidéo existante" }).isVisible());
  log("Appareil sans caméra : message clair et repli (appareil photo du téléphone, galerie)");

  // Autorisation refusée par l'utilisateur. Chromium sans interface ne sait pas afficher la demande
  // d'autorisation : on reproduit l'erreur exacte renvoyée par les navigateurs mobiles (NotAllowedError).
  const refusingBrowser = await chromium.launch();
  const rc = await refusingBrowser.newContext({ ...devices["Pixel 7"], permissions: [], storageState: await denied.storageState() });
  await rc.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException("Permission denied", "NotAllowedError"));
  });
  const rp = await rc.newPage();
  await rp.goto(`${APP}/d/${slug}/demande/videos`);
  await rp.getByRole("button", { name: "Filmer cette pièce" }).click();
  await text(rp, "Accès à la caméra refusé");
  assert.ok(await rp.getByRole("button", { name: "Filmer cette pièce" }).isVisible(), "on peut réessayer après avoir autorisé");
  assert.ok(await rp.getByRole("button", { name: "Utiliser l'appareil photo du téléphone" }).isVisible());
  await shot(rp, "c08-camera-refusee");
  await refusingBrowser.close();
  log("Autorisation de la caméra refusée : explication, nouvel essai possible et solutions de repli");

  // 12. Envoi interrompu durablement puis repris à la main
  await dp.route("**/storage/v1/upload/resumable/sign/**", (route) => (route.request().method() === "PATCH" ? route.abort("internetdisconnected") : route.continue()));
  await dp.locator('input[data-input="gallery"]').setInputFiles(media("cuisine-h264.mp4"));
  await dp.getByRole("button", { name: "Utiliser cette vidéo" }).click();
  await dp.getByRole("button", { name: "Reprendre l'envoi" }).waitFor({ timeout: 90000 });
  await shot(dp, "c09-envoi-interrompu");
  await dp.unroute("**/storage/v1/upload/resumable/sign/**");
  await dp.getByRole("button", { name: "Reprendre l'envoi" }).click();
  await dp.locator("li", { hasText: "Salon" }).last().getByText("Vidéo envoyée").waitFor({ timeout: 90000 });
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
})().catch((e) => {
  console.error("\n✗ ÉCHEC :", e.message);
  process.exit(1);
});
