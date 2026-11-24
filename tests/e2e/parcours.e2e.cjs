/**
 * Test de bout en bout de l'espace déménageur (navigateur réel).
 *
 * Prérequis : Supabase local démarré (npm run db:start) et l'application lancée
 * sur http://localhost:3000 avec .env.local pointant vers Supabase local.
 * Les e-mails sont lus dans Mailpit (boîte de test de Supabase local).
 *
 * Lancer : npm run test:e2e
 */
const { chromium, devices } = require("playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");

const APP = process.env.E2E_APP_URL || "http://localhost:3000";
const MAILPIT = process.env.E2E_MAILPIT_URL || "http://127.0.0.1:54324";
const SHOTS = process.env.E2E_SCREENSHOTS || "";
const stamp = Date.now().toString(36);
const alice = { name: "Alice Martin", email: `alice-${stamp}@test.local`, password: "Demenage2026" };
const bob = { name: "Bob Durand", email: `bob-${stamp}@test.local`, password: "Camion2026x" };

let step = 0;
const log = (msg) => console.log(`✓ ${String(++step).padStart(2, "0")} ${msg}`);

async function latestLink(email, contains) {
  for (let i = 0; i < 40; i++) {
    const res = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:"${email}"`)}`);
    const data = await res.json();
    for (const m of data.messages ?? []) {
      const full = await (await fetch(`${MAILPIT}/api/v1/message/${m.ID}`)).json();
      const links = [...(full.HTML || full.Text || "").matchAll(/href="([^"]+)"/g)].map((x) => x[1].replace(/&amp;/g, "&"));
      const link = links.find((l) => l.includes(contains));
      if (link) return link;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Aucun e-mail contenant ${contains} pour ${email}`);
}

async function shot(page, name) {
  if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage: true });
}

async function expectText(page, text) {
  await page.getByText(text, { exact: false }).first().waitFor({ timeout: 10000 });
}

async function signUpAndConfirm(page, user) {
  await page.goto(`${APP}/inscription`);
  await page.getByLabel("Votre nom").fill(user.name);
  await page.getByLabel("Adresse e-mail professionnelle").fill(user.email);
  await page.getByLabel("Mot de passe").fill(user.password);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Créer mon compte" }).click();
  await expectText(page, "Vérifiez votre boîte mail");
  const link = await latestLink(user.email, "/verify");
  await page.goto(link);
  await page.waitForURL(/\/espace\/bienvenue/);
}

async function createCompany(page, name) {
  await page.getByLabel("Nom commercial de votre entreprise").fill(name);
  await page.getByRole("button", { name: "Créer mon espace entreprise" }).click();
  await page.waitForURL(/\/espace\?message=bienvenue/);
}

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1360, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));

  // --- Protection des pages privées
  await page.goto(`${APP}/espace/demandes`);
  assert.match(page.url(), /\/connexion\?suivant=%2Fespace%2Fdemandes/);
  log("Page privée sans session : redirection vers la connexion");

  // --- Inscription : validation puis confirmation e-mail
  await page.goto(`${APP}/inscription`);
  await page.getByRole("button", { name: "Créer mon compte" }).click();
  await expectText(page, "Certains champs sont à corriger");
  await expectText(page, "Vous devez accepter les conditions");
  log("Inscription : erreurs de validation affichées");

  await page.getByLabel("Votre nom").fill(alice.name);
  await page.getByLabel("Adresse e-mail professionnelle").fill(alice.email);
  await page.getByLabel("Mot de passe").fill(alice.password);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Créer mon compte" }).click();
  await expectText(page, "Vérifiez votre boîte mail");
  log("Inscription envoyée, e-mail de confirmation demandé");

  await page.goto(`${APP}/connexion`);
  await page.getByLabel("Adresse e-mail").fill(alice.email);
  await page.getByLabel("Mot de passe").fill(alice.password);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expectText(page, "pas encore confirmée");
  assert.equal(await page.getByLabel("Adresse e-mail").inputValue(), alice.email);
  log("Connexion refusée tant que l'e-mail n'est pas confirmé (saisie conservée)");

  await page.goto(await latestLink(alice.email, "/verify"));
  await page.waitForURL(/\/espace\/bienvenue/);
  await shot(page, "01-bienvenue");
  log("Lien de confirmation : session ouverte, étape « créer l'entreprise »");

  await page.goto(`${APP}/espace/demandes`);
  await page.waitForURL(/\/espace\/bienvenue/);
  log("Sans entreprise, les pages de l'espace renvoient vers l'accueil");

  await createCompany(page, "Déménagements Alpha");
  await expectText(page, "Votre espace entreprise est prêt");
  await expectText(page, "Bonjour Alice");
  await expectText(page, "Aucune demande pour le moment");
  await shot(page, "02-tableau-de-bord-vide");
  log("Entreprise créée, tableau de bord vide sans fausses statistiques");

  // --- Demande manuelle
  await page.goto(`${APP}/espace/demandes/nouvelle`);
  await page.getByRole("button", { name: "Créer la demande" }).click();
  await expectText(page, "Le nom du client est obligatoire");
  await expectText(page, "Indiquez au moins un e-mail ou un téléphone");
  log("Demande : validation côté serveur");

  await page.getByLabel("Nom du client").fill("Claire Fontaine");
  await page.getByLabel("Téléphone").fill("06 12 34 56 78");
  await page.locator("#moving-date").fill("2027-01-14");
  await page.locator("#origin-city").fill("Lyon");
  await page.locator("#origin-floor").fill("4");
  await page.locator("#origin-elevator").selectOption("none");
  await page.locator("#destination-city").fill("Villeurbanne");
  await page.locator("#destination-floor").fill("0");
  await page.getByRole("button", { name: "Créer la demande" }).click();
  await page.waitForURL(/\/espace\/demandes\/[0-9a-f-]{36}\?message=creee/);
  const aliceRequestUrl = page.url().split("?")[0];
  await expectText(page, "Demande créée");
  await expectText(page, "DS-0001");
  await expectText(page, "4e étage");
  await expectText(page, "Inventaire vide");
  log("Demande créée avec numéro DS-0001 et logements");

  await page.locator("#status").selectOption("to_review");
  await page.getByRole("button", { name: "Mettre à jour" }).click();
  await expectText(page, "Statut mis à jour");
  await page.reload();
  await expectText(page, "Statut : À vérifier");
  log("Changement de statut historisé");

  await page.locator("#internal_notes").fill("Rappeler le client mardi.");
  await page.getByRole("button", { name: "Enregistrer les notes" }).click();
  await expectText(page, "Notes enregistrées");
  await shot(page, "03-fiche-demande");
  log("Notes internes enregistrées");

  await page.goto(`${APP}/espace`);
  await expectText(page, "Dernières demandes");
  assert.equal(await page.getByRole("link", { name: /À traiter/ }).first().locator("span").nth(1).innerText(), "1");
  log("Tableau de bord : compteurs issus des vraies données");

  // --- Paramètres de l'entreprise
  await page.goto(`${APP}/espace/entreprise`);
  await page.locator("#siret").fill("123");
  await page.getByRole("button", { name: "Enregistrer les informations" }).click();
  await expectText(page, "Le SIRET doit contenir 14 chiffres");
  await page.locator("#siret").fill("123 456 789 00012");
  await page.locator("#email").fill("contact@alpha.fr");
  await page.locator("#phone").fill("04 78 00 00 00");
  await page.locator("#city").fill("Lyon");
  await page.getByRole("button", { name: "Enregistrer les informations" }).click();
  await expectText(page, "Informations enregistrées");
  log("Informations entreprise validées et enregistrées");

  const png = path.join(os.tmpdir(), `logo-${stamp}.png`);
  fs.writeFileSync(png, Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkqPpfDwAD+gHAcgLz8QAAAABJRU5ErkJggg==", "base64"));
  await page.locator("#logo").setInputFiles(png);
  await page.getByLabel("Utiliser la couleur par défaut").uncheck();
  await page.locator("#brand_color").fill("#1f6e55");
  await page.getByRole("button", { name: "Enregistrer l'identité visuelle" }).click();
  await expectText(page, "Identité visuelle enregistrée");
  await page.reload();
  const logoSrc = await page.getByAltText("Logo actuel").getAttribute("src");
  const logoRes = await fetch(logoSrc);
  assert.equal(logoRes.status, 200);
  log("Logo envoyé dans le stockage et affiché");

  const fake = path.join(os.tmpdir(), `faux-${stamp}.png`);
  fs.writeFileSync(fake, "ceci n'est pas une image");
  await page.locator("#logo").setInputFiles(fake);
  await page.getByRole("button", { name: "Enregistrer l'identité visuelle" }).click();
  await expectText(page, "pas une image valide");
  log("Faux fichier image refusé");

  await page.locator("#quote_validity_days").fill("45");
  await page.locator("#quote_terms").fill("Devis valable sous réserve de visite technique.");
  await page.getByRole("button", { name: "Enregistrer les paramètres" }).click();
  await expectText(page, "Paramètres des devis enregistrés");
  log("Paramètres de devis enregistrés");

  // --- Tarifs
  await page.goto(`${APP}/espace/tarifs`);
  await page.locator("#price_per_m3").fill("92,50");
  await page.getByRole("button", { name: "Enregistrer la grille" }).click();
  await expectText(page, "Grille tarifaire enregistrée");
  await page.reload();
  assert.equal(await page.locator("#price_per_m3").inputValue(), "92,5");
  log("Grille tarifaire enregistrée (virgule décimale)");

  await page.locator("#new-opt-name").fill("Garde-meubles (par mois)");
  await page.locator("#new-opt-price").fill("120");
  await page.getByRole("button", { name: "Ajouter l'option" }).click();
  await expectText(page, "Option ajoutée");
  await page.reload();
  assert.equal(await page.locator('input[value="Garde-meubles (par mois)"]').count(), 1);
  log("Option ajoutée");

  await page.locator("#new-sur-name").fill("Piano droit");
  await page.locator("#new-sur-amount").fill("150");
  await page.getByRole("button", { name: "Ajouter", exact: true }).click();
  await expectText(page, "Supplément ajouté");
  log("Supplément d'objet spécifique ajouté");

  // --- Profil et mot de passe
  await page.goto(`${APP}/espace/profil`);
  await page.locator("#phone").fill("06 11 22 33 44");
  await page.getByRole("button", { name: "Enregistrer le profil" }).click();
  await expectText(page, "Profil enregistré");
  await page.locator("#currentPassword").fill("mauvais-mdp1");
  await page.locator("#password").fill("NouveauMdp2026");
  await page.locator("#confirmPassword").fill("NouveauMdp2026");
  await page.getByRole("button", { name: "Changer le mot de passe" }).click();
  await expectText(page, "Le mot de passe actuel est incorrect");
  log("Profil enregistré ; changement de mot de passe refusé sans le bon mot de passe actuel");

  // --- Déconnexion puis mot de passe oublié
  await page.getByRole("button", { name: "Se déconnecter" }).click();
  await page.waitForURL(/\/connexion\?message=deconnecte/);
  await page.goto(`${APP}/espace`);
  assert.match(page.url(), /\/connexion/);
  log("Déconnexion : l'espace n'est plus accessible");

  await page.goto(`${APP}/mot-de-passe-oublie`);
  await page.getByLabel("Adresse e-mail").fill(alice.email);
  await page.getByRole("button", { name: "Recevoir le lien" }).click();
  await expectText(page, "Si un compte existe");
  await page.goto(await latestLink(alice.email, "nouveau-mot-de-passe"));
  await page.waitForURL(/\/nouveau-mot-de-passe/);
  await page.getByLabel("Nouveau mot de passe").fill("Reinitialise2026");
  await page.getByLabel("Confirmez le mot de passe").fill("Reinitialise2026");
  await page.getByRole("button", { name: "Enregistrer le mot de passe" }).click();
  await page.waitForURL(/\/espace\?message=mot-de-passe-modifie/);
  log("Mot de passe réinitialisé par e-mail");

  await page.getByRole("button", { name: "Se déconnecter" }).click();
  await page.waitForURL(/\/connexion\?message=deconnecte/);
  await page.getByLabel("Adresse e-mail").fill(alice.email);
  await page.getByLabel("Mot de passe").fill("Reinitialise2026");
  await page.getByRole("button", { name: "Se connecter" }).click();
  await page.waitForURL(/\/espace$/);
  await page.getByRole("button", { name: "Se déconnecter" }).click();
  await page.waitForURL(/\/connexion\?message=deconnecte/);
  log("Connexion avec le nouveau mot de passe");

  // --- Deuxième entreprise : isolation
  await ctx.clearCookies();
  await signUpAndConfirm(page, bob);
  await createCompany(page, "Transports Bravo");
  await expectText(page, "Aucune demande pour le moment");
  const res = await page.goto(aliceRequestUrl);
  assert.equal(res.status(), 404);
  log("Bob (autre entreprise) obtient « introuvable » sur la demande d'Alice");
  await page.goto(`${APP}/espace/demandes`);
  await expectText(page, "Aucune demande pour le moment");
  await page.goto(`${APP}/espace/tarifs`);
  assert.equal(await page.locator("#price_per_m3").inputValue(), "85");
  assert.equal(await page.locator('input[value="Garde-meubles (par mois)"]').count(), 0);
  log("Bob ne voit ni les demandes ni les tarifs d'Alice");

  // --- Mobile
  const mobile = await browser.newContext({ ...devices["iPhone 13"] });
  await mobile.addCookies(await ctx.cookies());
  const m = await mobile.newPage();
  m.on("pageerror", (e) => errors.push(String(e)));
  await m.goto(`${APP}/espace`);
  const overflow = await m.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  assert.equal(overflow, 0);
  await m.getByRole("button", { name: "Ouvrir le menu" }).click();
  await m.getByRole("link", { name: "Tarifs et options" }).click();
  await m.waitForURL(/\/espace\/tarifs/);
  assert.equal(await m.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), 0);
  await shot(m, "04-mobile-tarifs");
  log("Mobile : menu, navigation et aucun débordement horizontal");

  assert.deepEqual(errors, [], `Erreurs JavaScript : ${errors.join("\n")}`);
  log("Aucune erreur JavaScript dans le navigateur");
  await browser.close();
  console.log(`\nTous les parcours passent (${step} vérifications).`);
})().catch(async (e) => {
  console.error("\n✗ ÉCHEC :", e.message);
  process.exit(1);
});
