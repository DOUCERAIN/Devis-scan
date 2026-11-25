/**
 * Test de bout en bout : validation de l'inventaire par le client, devis final, vérification par le déménageur.
 *
 * Les demandes sont préparées directement en base au stade « inventaire en attente de validation client »
 * (le parcours vidéo complet est couvert par parcours-client.e2e.cjs). Tout le reste passe par l'application,
 * dans un vrai navigateur.
 *
 *   Parcours 1 — le client valide et accepte ; le déménageur confirme : aucun changement, rien à faire pour le client.
 *   Cas A      — devis non encore accepté ; le déménageur corrige une réponse du client : nouvelle version soumise,
 *                réponse du client conservée, e-mail préparé ; le client accepte la nouvelle version.
 *   Cas C      — devis accepté ; correction sans effet sur le prix : aucune nouvelle version, trace conservée,
 *                client informé sans nouvelle acceptation.
 * (Parcours 2 — avenant après acceptation, refusé — est dans parcours-client.e2e.cjs.)
 *
 * Prérequis : Supabase local, application lancée (aucune analyse IA n'est nécessaire).
 * Lancer : NODE_PATH=$(npm root -g) node tests/e2e/verification.e2e.cjs
 */
const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { createClient } = require("@supabase/supabase-js");

process.loadEnvFile?.(".env.local");
const APP = process.env.E2E_APP_URL || "http://localhost:3000";
const DB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
assert.match(DB_URL, /127\.0\.0\.1|localhost/, "Réservé à Supabase local");
const admin = createClient(DB_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
const anon = createClient(DB_URL, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
const stamp = Date.now().toString(36);
let step = 0;
const log = (m) => console.log(`✓ ${String(++step).padStart(2, "0")} ${m}`);

async function mover() {
  const email = `verif-${stamp}@test.local`;
  const password = "Demenage2026";
  const { error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: "Vérif" } });
  if (error) throw error;
  const client = createClient(DB_URL, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
  await client.auth.signInWithPassword({ email, password });
  const { data: company, error: e2 } = await client.rpc("create_company", { company_name: `Vérification ${stamp}` });
  if (e2) throw e2;
  // Grille enregistrée par l'entreprise (déclencheur « configured_at ») et identité légale complète.
  const { error: e3 } = await client.from("pricing_settings").update({ price_per_m3: 80, minimum_price: 300, price_per_extra_km: 0 }).eq("company_id", company.id);
  if (e3) throw e3;
  await admin.from("companies").update({ legal_name: "Vérification SARL", siret: "12345678900012", address_line1: "1 rue du Test", postal_code: "69001", city: "Lyon" }).eq("id", company.id);
  return { email, password, company };
}

/** Demande analysée, en attente de validation : 2 lits simples (le second signalé « à vérifier ») et une armoire. */
async function seedRequest(company, name) {
  const { data, error } = await anon.rpc("create_public_request", {
    company_slug: company.slug,
    payload: { customer: { full_name: name, email: `${name.toLowerCase().replace(/\W+/g, "-")}-${stamp}@example.com` }, origin: { city: "Lyon", postal_code: "69001" }, destination: { city: "Lyon", postal_code: "69003" } },
  });
  if (error) throw error;
  const requestId = data[0].request_id;
  const viewToken = crypto.randomBytes(32).toString("hex");
  const viewHash = crypto.createHash("sha256").update(viewToken).digest("hex");
  const { error: e1 } = await admin.from("quote_requests").update({ status: "submitted", submitted_at: new Date().toISOString(), view_token_hash: viewHash }).eq("id", requestId);
  if (e1) throw e1;
  await admin.from("quote_requests").update({ status: "awaiting_customer" }).eq("id", requestId);
  const { data: room } = await admin.from("rooms").insert({ request_id: requestId, company_id: company.id, name: "Chambre" }).select("id").single();
  const { data: items, error: e2 } = await admin.from("inventory_items").insert([
    { request_id: requestId, company_id: company.id, room_id: room.id, name: "Lit simple", ai_label: "Lit simple", catalog_key: "lit-simple", quantity: 1, unit_volume_m3: 1.2, source: "ai", confidence: 0.95, volume_source: "catalog", possible_duplicate: false, duplicate_reason: null },
    { request_id: requestId, company_id: company.id, room_id: room.id, name: "Lit simple", ai_label: "Lit simple (fenêtre)", catalog_key: "lit-simple", quantity: 1, unit_volume_m3: 1.2, source: "ai", confidence: 0.95, volume_source: "catalog", possible_duplicate: true,
      duplicate_reason: "Même type de meuble (Lit simple) que « Lit simple », jamais visibles ensemble sur une même image : il peut s'agir du même meuble filmé à deux moments." },
    { request_id: requestId, company_id: company.id, room_id: room.id, name: "Armoire 2 portes", ai_label: "Armoire", catalog_key: "armoire-2-portes", quantity: 1, unit_volume_m3: 1.5, source: "ai", confidence: 0.95, volume_source: "catalog", possible_duplicate: false, duplicate_reason: null },
  ]).select("id, ai_label");
  if (e2) throw e2;
  const [bed1, bed2] = [items.find((i) => i.ai_label === "Lit simple"), items.find((i) => i.ai_label === "Lit simple (fenêtre)")];
  await admin.from("inventory_items").update({ duplicate_of_item_id: bed1.id }).eq("id", bed2.id);
  return { requestId, viewToken, url: `${APP}/d/${company.slug}/devis/${viewToken}`, bed2: bed2.id };
}

const text = (page, t, timeout = 20000) => page.getByText(t, { exact: false }).first().waitFor({ timeout });

async function validate(page, url, answer) {
  await page.goto(url);
  await text(page, "Éléments à vérifier");
  await text(page, "apparaît à un autre moment de votre vidéo");
  await page.getByTestId("to-check").getByLabel(answer).check();
  await page.getByLabel("J'ai pris connaissance de cet avertissement.").check();
  await page.getByRole("button", { name: "Valider mon inventaire et recevoir mon devis" }).click();
  await text(page, "Détail du prix");
}

const quotesOf = async (requestId) => (await admin.from("quotes").select("id, version, status, origin, total_ttc_cents, amends_quote_id, volume_snapshot").eq("request_id", requestId).order("version")).data;
const requestOf = async (requestId) => (await admin.from("quote_requests").select("status, verification_status").eq("id", requestId).single()).data;

(async () => {
  const pro = await mover();
  const browser = await chromium.launch();
  const errors = [];
  const client = await (await browser.newContext()).newPage();
  client.on("pageerror", (e) => errors.push(String(e)));
  const proPage = await (await browser.newContext({ viewport: { width: 1360, height: 900 } })).newPage();
  proPage.on("pageerror", (e) => errors.push(String(e)));
  await proPage.goto(`${APP}/connexion`);
  await proPage.getByLabel("Adresse e-mail").fill(pro.email);
  await proPage.getByLabel("Mot de passe").fill(pro.password);
  await proPage.getByRole("button", { name: "Se connecter" }).click();
  await proPage.waitForURL(/\/espace$/);

  // ---------------- Parcours 1 : le déménageur confirme les décisions du client ----------------
  const p1 = await seedRequest(pro.company, "Paul Un");
  // Validation impossible sans réponse : contrôle côté serveur (le navigateur l'empêche aussi).
  const { error: refused } = await anon.rpc("validate_public_inventory", { token: p1.viewToken, decisions: {}, acknowledgement: "Merci de vérifier attentivement votre inventaire et de répondre avec honnêteté." });
  assert.ok(refused, "validation refusée tant qu'un élément n'a pas de réponse");
  await validate(client, p1.url, "C'est le même meuble : ne le compter qu'une fois");
  let q = await quotesOf(p1.requestId);
  assert.deepEqual(q.map((x) => [x.version, x.status, x.origin]), [[1, "sent", "customer_validation"]]);
  assert.equal(q[0].volume_snapshot.estimatedM3, 2.7, "lit déclaré « même meuble » compté une seule fois (1,2 + 1,5 m³)");
  log("Parcours 1 : le client valide son inventaire (réponse obligatoire contrôlée en base) et reçoit aussitôt son devis final V1");
  await client.getByRole("button", { name: "Accepter le devis" }).click();
  await text(client, "Vous avez accepté ce devis");
  assert.deepEqual(await requestOf(p1.requestId), { status: "accepted", verification_status: "pending" });
  log("Parcours 1 : le client accepte immédiatement, la vérification humaine est encore en attente");

  await proPage.goto(`${APP}/espace/demandes/${p1.requestId}`);
  await text(proPage, "Dossier de vérification");
  await text(proPage, "Vérification humaine en attente");
  await text(proPage, "Devis accepté par le client");
  await proPage.getByRole("button", { name: "Confirmer l'inventaire et les décisions du client" }).click();
  await text(proPage, "Dossier vérifié");
  await text(proPage, "Vérifié par le déménageur");
  const q1after = await quotesOf(p1.requestId);
  assert.deepEqual(q1after.map((x) => [x.version, x.status, x.total_ttc_cents]), [[1, "accepted", q[0].total_ttc_cents]], "aucune nouvelle version, prix inchangé");
  const { data: v1 } = await admin.from("inventory_verifications").select("outcome, volume_before_m3, volume_after_m3, total_before_cents, total_after_cents").eq("request_id", p1.requestId).single();
  assert.equal(v1.outcome, "confirmed");
  assert.equal(Number(v1.volume_before_m3), Number(v1.volume_after_m3));
  assert.equal(v1.total_before_cents, v1.total_after_cents);
  assert.equal((await admin.from("customer_notifications").select("id").eq("request_id", p1.requestId)).data.length, 0, "aucune notification inutile");
  assert.deepEqual(await requestOf(p1.requestId), { status: "accepted", verification_status: "verified" });
  await client.goto(p1.url);
  await text(client, "Vous avez accepté ce devis");
  assert.equal(await client.getByRole("button", { name: "Accepter le devis" }).count(), 0, "aucune nouvelle action demandée au client");
  assert.equal(await client.getByText("Votre inventaire a été vérifié").count(), 0);
  log("Parcours 1 : le déménageur confirme ; aucun changement de volume ni de prix, aucune version, aucune notification, rien à faire pour le client");

  // ---------------- Cas A : devis non accepté, le déménageur corrige une réponse du client ----------------
  const a = await seedRequest(pro.company, "Alice Deux");
  await validate(client, a.url, "C'est un autre meuble : garder les deux");
  const qa = await quotesOf(a.requestId);
  assert.equal(qa[0].volume_snapshot.estimatedM3, 3.9, "deux lits comptés selon la réponse du client");
  await proPage.goto(`${APP}/espace/demandes/${a.requestId}`);
  const dupRow = proPage.locator("li").filter({ has: proPage.getByTestId("duplicate-box") }).first();
  await dupRow.locator("summary").click();
  await text(proPage, "un autre meuble (gardé)");
  await dupRow.getByRole("button", { name: "Le même meuble (compter une fois)" }).click();
  await text(proPage, "Inventaire mis à jour");
  assert.equal(await proPage.getByRole("button", { name: "Confirmer l'inventaire et les décisions du client" }).count(), 0, "une correction exige d'être enregistrée avec sa raison");
  await proPage.getByLabel("Raison de la modification (communiquée au client)").fill("Le même lit a été filmé depuis la fenêtre.");
  await proPage.getByRole("button", { name: "Enregistrer les corrections et informer le client" }).click();
  await text(proPage, "Nouvelle version V2 transmise au client");
  const qa2 = await quotesOf(a.requestId);
  assert.deepEqual(qa2.map((x) => [x.version, x.status, x.origin, x.amends_quote_id]), [[1, "superseded", "customer_validation", null], [2, "sent", "verification", null]]);
  assert.ok(qa2[1].total_ttc_cents < qa2[0].total_ttc_cents, "un lit de moins : prix recalculé à la baisse");
  const { data: bed } = await admin.from("inventory_items").select("customer_duplicate_decision, mover_duplicate_decision, possible_duplicate, duplicate_reason").eq("id", a.bed2).single();
  assert.deepEqual([bed.customer_duplicate_decision, bed.mover_duplicate_decision, bed.possible_duplicate], ["distinct", "same", true], "réponse du client et signalement d'origine conservés");
  const { data: mailA } = await admin.from("customer_notifications").select("status, body_text").eq("request_id", a.requestId).single();
  assert.equal(mailA.status, "not_configured");
  assert.match(mailA.body_text, /Meubles retirés :\n  - Lit simple : compté une seule fois/);
  assert.match(mailA.body_text, /nouvelle version de votre devis \(version 2\)/);
  const { data: histA } = await admin.from("inventory_item_changes").select("actor, action, changes, changed_by").eq("request_id", a.requestId).order("changed_at");
  assert.deepEqual(histA.map((h) => [h.actor, h.action]), [["customer", "customer_decision"], ["mover", "duplicate_decision"]]);
  assert.equal(histA[0].changed_by, null, "réponse du client : pas d'utilisateur");
  assert.ok(histA[1].changed_by, "correction : auteur enregistré");
  log("Cas A : le déménageur corrige une réponse du client avant acceptation ; V1 conservée (remplacée), V2 recalculée et transmise, réponse du client intacte, e-mail préparé, historique avec auteurs");
  await client.goto(a.url);
  await text(client, "Nouvelle version de votre devis (version 2)");
  await text(client, "Le même lit a été filmé depuis la fenêtre.");
  await text(client, "Différences avec la version précédente");
  await client.getByRole("button", { name: "Accepter le devis" }).click();
  await text(client, "Vous avez accepté ce devis");
  assert.deepEqual((await quotesOf(a.requestId)).map((x) => x.status), ["superseded", "accepted"]);
  log("Cas A : le client consulte les différences et accepte la nouvelle version");

  // ---------------- Cas C : devis accepté, correction sans effet sur le prix ----------------
  const c = await seedRequest(pro.company, "Chloé Trois");
  await validate(client, c.url, "C'est un autre meuble : garder les deux");
  await client.getByRole("button", { name: "Accepter le devis" }).click();
  await text(client, "Vous avez accepté ce devis");
  await proPage.goto(`${APP}/espace/demandes/${c.requestId}`);
  const wardrobe = proPage.locator("li", { hasText: "Armoire 2 portes" }).first();
  await wardrobe.locator("summary").click();
  await wardrobe.getByLabel("Nom").fill("Armoire 2 portes en chêne");
  await wardrobe.getByRole("button", { name: "Enregistrer et valider" }).click();
  await text(proPage, "Inventaire mis à jour");
  await proPage.getByLabel("Raison de la modification (communiquée au client)").fill("Précision sur la nature de l'armoire.");
  await proPage.getByRole("button", { name: "Enregistrer les corrections et informer le client" }).click();
  await text(proPage, "montant et conditions du devis inchangés");
  const qc = await quotesOf(c.requestId);
  assert.deepEqual(qc.map((x) => [x.version, x.status]), [[1, "accepted"]], "aucune nouvelle version, devis accepté intact");
  const { data: vc } = await admin.from("inventory_verifications").select("outcome, reason, quote_after_id, changes").eq("request_id", c.requestId).single();
  assert.equal(vc.outcome, "corrected_same_terms");
  assert.equal(vc.quote_after_id, null);
  assert.match(vc.changes[0].label, /Armoire 2 portes en chêne/);
  const { data: mailC } = await admin.from("customer_notifications").select("status, subject, body_text").eq("request_id", c.requestId).single();
  assert.match(mailC.subject, /devis inchangé/);
  assert.match(mailC.body_text, /vous n'avez rien à faire/);
  assert.deepEqual(await requestOf(c.requestId), { status: "accepted", verification_status: "corrected" });
  await client.goto(c.url);
  await text(client, "Votre inventaire a été vérifié");
  await text(client, "vous n'avez rien à faire");
  assert.equal(await client.getByRole("button", { name: "Accepter le devis" }).count(), 0, "pas de nouvelle acceptation demandée");
  log("Cas C : correction sans effet sur le prix ; aucune nouvelle version, trace et information du client, aucune acceptation redemandée");

  assert.deepEqual(errors, [], errors.join("\n"));
  log("Aucune erreur JavaScript");
  await browser.close();
  console.log(`\nVérification par le déménageur : parcours réussis (${step} vérifications).`);
})().catch((e) => {
  console.error("\n✗ ÉCHEC :", e);
  process.exit(1);
});
