/**
 * Prépare les images de l'évaluation IA en passant par le VRAI parcours client de la phase 3 :
 * pour chaque cas du jeu de données (tests/ai-eval/dataset/<cas>/case.json) qui a une vidéo
 * (dataset/<cas>/video.mp4 ou .mov, sinon videos/<cas>.mp4 créée par make-videos.sh), une pièce est ajoutée,
 * la vidéo est choisie dans la « galerie », compressée et découpée en images dans le navigateur (Chromium),
 * puis envoyée. Les images réellement stockées remplacent dataset/<cas>/frames/ et la liste « frames »
 * du case.json est mise à jour (la référence n'est pas modifiée ; vérifier qu'elle correspond toujours aux images).
 *
 * Prérequis : Supabase local, application lancée SANS analyse IA (ne pas définir AI_PROVIDER), vidéos présentes.
 * Lancer : NODE_PATH=$(npm root -g) node tests/ai-eval/prepare-frames.e2e.cjs [cas1,cas2]
 * Dossier du jeu de données : AI_EVAL_DATASET (défaut tests/ai-eval/dataset).
 */
const { chromium, devices } = require("playwright");
const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");
const { createClient } = require("@supabase/supabase-js");

process.loadEnvFile?.(".env.local");
const APP = process.env.E2E_APP_URL || "http://localhost:3000";
const DB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
assert.match(DB_URL, /127\.0\.0\.1|localhost/, "Réservé à Supabase local");
const admin = createClient(DB_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
const HERE = __dirname;
const DATASET = path.resolve(process.env.AI_EVAL_DATASET || path.join(HERE, "dataset"));
const ONLY = process.argv[2] ? new Set(process.argv[2].split(",")) : null;
const videoOf = (id) => [path.join(DATASET, id, "video.mp4"), path.join(DATASET, id, "video.mov"), path.join(HERE, "videos", `${id}.mp4`)].find((f) => fs.existsSync(f));
const stamp = Date.now().toString(36);

const ADDRESS = (q) => ({
  type: "FeatureCollection",
  features: [/lyon/i.test(q)
    ? { type: "Feature", geometry: { type: "Point", coordinates: [4.8357, 45.764] }, properties: { label: "12 Rue de la République 69002 Lyon", name: "12 Rue de la République", postcode: "69002", city: "Lyon", type: "housenumber" } }
    : { type: "Feature", geometry: { type: "Point", coordinates: [2.0706, 49.0368] }, properties: { label: "8 Boulevard du Port 95000 Cergy", name: "8 Boulevard du Port", postcode: "95000", city: "Cergy", type: "housenumber" } }],
});

(async () => {
  const rooms = fs.readdirSync(DATASET)
    .filter((id) => fs.existsSync(path.join(DATASET, id, "case.json")) && (!ONLY || ONLY.has(id)) && videoOf(id))
    .map((id) => [id, { label: JSON.parse(fs.readFileSync(path.join(DATASET, id, "case.json"), "utf8")).room_label }]);
  assert.ok(rooms.length > 0, "Aucun cas avec vidéo (dataset/<cas>/video.mp4, ou tests/ai-eval/make-videos.sh)");
  assert.equal(new Set(rooms.map(([, r]) => r.label)).size, rooms.length, "Deux cas ont le même nom de pièce : traiter en plusieurs fois (argument cas1,cas2)");

  const email = `eval-${stamp}@test.local`;
  await admin.auth.admin.createUser({ email, password: "Demenage2026", email_confirm: true });
  const client = createClient(DB_URL, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
  await client.auth.signInWithPassword({ email, password: "Demenage2026" });
  const { data: company, error } = await client.rpc("create_company", { company_name: `Évaluation IA ${stamp}` });
  if (error) throw error;

  const browser = await chromium.launch();
  const ctx = await browser.newContext({ ...devices["Pixel 7"] });
  await ctx.route("https://data.geopf.fr/geocodage/search**", (r) => r.fulfill({ json: ADDRESS(new URL(r.request().url()).searchParams.get("q") ?? ""), headers: { "access-control-allow-origin": "*" } }));
  const page = await ctx.newPage();
  const text = (t, timeout = 15000) => page.getByText(t, { exact: false }).first().waitFor({ timeout });

  await page.goto(`${APP}/d/${company.slug}/demande/trajet`);
  for (const [label, typed] of [["Adresse de départ", "8 bd du port"], ["Adresse d'arrivée", "12 rue lyon"]]) {
    await page.getByLabel(label, { exact: true }).fill(typed);
    await page.getByRole("option").first().click();
  }
  await page.locator("#moving_date").fill(new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10));
  await page.getByLabel("Nom et prénom").fill("Évaluation IA");
  await page.getByLabel("E-mail").fill(`eval-client-${stamp}@example.com`);
  await page.getByLabel("Téléphone").fill("06 00 00 00 00");
  await page.getByRole("checkbox", { name: /J'accepte/ }).check();
  await page.getByRole("button", { name: "Continuer" }).click();
  await page.waitForURL(/logements$/).catch(async (e) => { console.error(await page.locator("main").innerText()); throw e; });
  await page.getByText("Appartement").first().click();
  await page.locator("#origin-floor").fill("2");
  await page.getByText("Pas d'ascenseur").first().click();
  await page.getByText("Maison").nth(1).click();
  await page.getByText("Pas d'ascenseur").nth(1).click();
  await page.getByRole("button", { name: "Continuer" }).click();
  await page.waitForURL(/pieces$/).catch(async (e) => { console.error(await page.locator("main").innerText()); throw e; });
  for (const [, room] of rooms) {
    await page.locator("#new-room-name").fill(room.label);
    await page.getByRole("button", { name: "Ajouter la pièce" }).click();
    await text(`« ${room.label} » ajoutée`);
  }
  await page.getByRole("button", { name: "Continuer vers les vidéos" }).click();
  await page.waitForURL(/videos$/);

  for (const [i, [id, room]] of rooms.entries()) {
    const card = page.locator("li", { hasText: room.label }).last();
    if (i > 0) await page.getByRole("button", { name: new RegExp(room.label) }).first().click();
    await page.locator('input[data-input="gallery"]').setInputFiles(videoOf(id));
    await page.getByRole("button", { name: "Utiliser cette vidéo" }).click();
    await card.getByText("Vidéo envoyée").waitFor({ timeout: 120000 });
    console.log(`✓ ${room.label} : vidéo traitée par le navigateur et envoyée`);
  }

  // Images réellement extraites et stockées par la phase 3
  const { data: requests } = await admin.from("quote_requests").select("id").eq("company_id", company.id);
  const requestId = requests[0].id;
  const { data: dbRooms } = await admin.from("rooms").select("id, name, room_videos(id, width, height, processing, video_frames(storage_path, captured_at_ms, width, height))").eq("request_id", requestId).order("position");
  for (const [id, room] of rooms) {
    const dbRoom = dbRooms.find((r) => r.name === room.label);
    const frames = dbRoom.room_videos.flatMap((v) => v.video_frames).sort((a, b) => a.captured_at_ms - b.captured_at_ms);
    const framesDir = path.join(DATASET, id, "frames");
    fs.rmSync(framesDir, { recursive: true, force: true });
    fs.mkdirSync(framesDir, { recursive: true });
    const files = [];
    for (const [n, f] of frames.entries()) {
      const { data: blob, error: e } = await admin.storage.from("request-media").download(f.storage_path);
      if (e) throw e;
      const file = `${String(n).padStart(2, "0")}.jpg`;
      fs.writeFileSync(path.join(framesDir, file), Buffer.from(await blob.arrayBuffer()));
      files.push({ file, captured_at_ms: f.captured_at_ms });
    }
    const casePath = path.join(DATASET, id, "case.json");
    const data = JSON.parse(fs.readFileSync(casePath, "utf8"));
    data.frames = files;
    fs.writeFileSync(casePath, JSON.stringify(data, null, 2) + "\n");
    console.log(`✓ ${room.label} : ${files.length} images extraites (vidéo ${dbRoom.room_videos[0].processing}) → ${path.relative(process.cwd(), framesDir)}`);
  }
  await browser.close();
  console.log(`\nImages prêtes (${rooms.length} cas). Vérifier les références, puis : node --conditions=react-server tests/ai-eval/bench.ts`);
})().catch((e) => {
  console.error("✗ ÉCHEC :", e);
  process.exit(1);
});
