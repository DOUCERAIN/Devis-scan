/**
 * Test d'intégration : parcours particulier + stockage privé + purge RGPD.
 * Utilise la vraie API Supabase locale (base, authentification, stockage)
 * et l'application lancée sur http://localhost:3000 (pour la tâche de purge).
 *
 * Lancer : npm run test:integration
 */
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";

process.loadEnvFile?.(".env.local");
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const PUBLISHABLE = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const SECRET = process.env.SUPABASE_SECRET_KEY;
const CRON = process.env.CRON_SECRET;
const APP = process.env.E2E_APP_URL || "http://localhost:3000";
assert.ok(URL && PUBLISHABLE && SECRET && CRON, "Variables .env.local manquantes");
assert.match(URL, /127\.0\.0\.1|localhost/, "Ce test ne doit tourner que sur Supabase local");

const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(URL, SECRET, opts);
const anon = createClient(URL, PUBLISHABLE, opts);
const stamp = Date.now().toString(36);
let step = 0;
const log = (m) => console.log(`✓ ${String(++step).padStart(2, "0")} ${m}`);

async function moverWithCompany(label) {
  const email = `${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${stamp}@test.local`;
  const password = "Integration2026";
  const { error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: label } });
  if (error) throw error;
  const client = createClient(URL, PUBLISHABLE, opts);
  const { error: e2 } = await client.auth.signInWithPassword({ email, password });
  if (e2) throw e2;
  const { data: company, error: e3 } = await client.rpc("create_company", { company_name: `${label} ${stamp}` });
  if (e3) throw e3;
  return { client, company };
}

const a = await moverWithCompany("Entreprise A");
const b = await moverWithCompany("Entreprise B");
log("Deux déménageurs et deux entreprises créés");

// --- Le particulier (sans compte) crée sa demande
const { data: created, error: e1 } = await anon.rpc("create_public_request", {
  company_slug: a.company.slug,
  payload: { customer: { full_name: "Paul Client", email: "paul@example.com" }, origin: { city: "Lyon", floor: "3", elevator: "none" }, destination: { city: "Bron" } },
});
assert.ifError(e1);
const { request_id: requestId, access_token: token } = created[0];
const { data: roomId, error: e2 } = await anon.rpc("add_public_room", { access_token: token, room_name: "Salon", room_kind: "living" });
assert.ifError(e2);
log("Demande et pièce créées par un visiteur anonyme avec son jeton");

// --- Envoi de la vidéo par URL signée
const video = Buffer.alloc(4096, 7);
const { data: slot, error: e3 } = await anon.rpc("register_public_video", { access_token: token, room_id: roomId, mime_type: "video/mp4", size_bytes: video.length });
assert.ifError(e3);
const path = slot[0].storage_path;
assert.ok(path.startsWith(`${a.company.id}/${requestId}/videos/`));

const { error: direct } = await anon.storage.from("request-media").upload(path, video, { contentType: "video/mp4" });
assert.ok(direct, "Un envoi direct sans URL signée doit être refusé");
log("Envoi direct dans le stockage privé refusé");

const { data: signed, error: e4 } = await admin.storage.from("request-media").createSignedUploadUrl(path);
assert.ifError(e4);
const { error: e5 } = await anon.storage.from("request-media").uploadToSignedUrl(path, signed.token, video, { contentType: "video/mp4" });
assert.ifError(e5);
log("Vidéo envoyée par URL signée (comme le fera le navigateur du particulier)");

const folder = path.slice(0, path.lastIndexOf("/"));
const { data: listed } = await admin.storage.from("request-media").list(folder);
const size = listed.find((f) => path.endsWith(f.name))?.metadata?.size;
assert.equal(size, video.length);
const { error: e6 } = await admin.rpc("mark_video_uploaded", { access_token: token, video_id: slot[0].video_id, actual_size: size, duration_seconds: 12 });
assert.ifError(e6);
const { error: e7 } = await anon.rpc("submit_public_request", { access_token: token });
assert.ifError(e7);
log("Envoi confirmé par le serveur, demande envoyée");

// --- Lecture : seule l'entreprise A y a accès
const { data: urlA, error: e8 } = await a.client.storage.from("request-media").createSignedUrl(path, 60);
assert.ifError(e8);
const res = await fetch(urlA.signedUrl);
assert.equal(res.status, 200);
assert.equal(Buffer.from(await res.arrayBuffer()).length, video.length);
log("L'entreprise A lit la vidéo par un lien temporaire");

const { error: eB } = await b.client.storage.from("request-media").createSignedUrl(path, 60);
assert.ok(eB, "L'entreprise B ne doit pas obtenir de lien");
const { error: eAnon } = await anon.storage.from("request-media").createSignedUrl(path, 60);
assert.ok(eAnon, "Un visiteur ne doit pas obtenir de lien");
const { data: rowsB } = await b.client.from("room_videos").select("id").eq("id", slot[0].video_id);
assert.equal(rowsB.length, 0);
log("Ni l'entreprise B ni un visiteur ne peuvent lire la vidéo");

// --- Purge RGPD : suppression réelle du fichier
const unauthorized = await fetch(`${APP}/api/taches/purge-videos`, { headers: { authorization: "Bearer mauvais-secret" } });
assert.equal(unauthorized.status, 401);
log("Tâche de purge refusée sans le bon secret");

const { error: e9 } = await admin.from("room_videos").update({ delete_after: new Date(Date.now() - 86400000).toISOString() }).eq("id", slot[0].video_id);
assert.ifError(e9);
const purge = await fetch(`${APP}/api/taches/purge-videos`, { headers: { authorization: `Bearer ${CRON}` } });
assert.equal(purge.status, 200);
const result = await purge.json();
assert.ok(result.purged >= 1, JSON.stringify(result));
const { data: after } = await admin.storage.from("request-media").list(folder);
assert.equal(after.filter((f) => path.endsWith(f.name)).length, 0, "Le fichier doit avoir disparu du stockage");
const { data: row } = await admin.from("room_videos").select("status, deleted_at").eq("id", slot[0].video_id).single();
assert.equal(row.status, "deleted");
assert.ok(row.deleted_at);
log("Vidéo échue réellement supprimée du stockage, puis marquée supprimée en base");

// --- Brouillon abandonné (jamais envoyé) : supprimé avec ses fichiers après 30 jours
const { data: draft } = await anon.rpc("create_public_request", {
  company_slug: a.company.slug,
  payload: { customer: { full_name: "Client parti", email: "parti@example.com" }, origin: { city: "Lyon" } },
});
const draftToken = draft[0].access_token;
const { data: draftRoom } = await anon.rpc("add_public_room", { access_token: draftToken, room_name: "Salon" });
const { data: draftSlot } = await anon.rpc("register_public_video", { access_token: draftToken, room_id: draftRoom, mime_type: "video/mp4", size_bytes: video.length });
const draftPath = draftSlot[0].storage_path;
const { data: draftSigned } = await admin.storage.from("request-media").createSignedUploadUrl(draftPath);
await anon.storage.from("request-media").uploadToSignedUrl(draftPath, draftSigned.token, video, { contentType: "video/mp4" });
await admin.rpc("mark_video_uploaded", { access_token: draftToken, video_id: draftSlot[0].video_id, actual_size: video.length });
await admin.from("quote_requests").update({ created_at: new Date(Date.now() - 31 * 86400000).toISOString() }).eq("id", draft[0].request_id);
const purge2 = await (await fetch(`${APP}/api/taches/purge-videos`, { headers: { authorization: `Bearer ${CRON}` } })).json();
assert.ok(purge2.abandonedDrafts >= 1, JSON.stringify(purge2));
const { data: gone } = await admin.from("quote_requests").select("id").eq("id", draft[0].request_id);
assert.equal(gone.length, 0);
const draftFolder = draftPath.slice(0, draftPath.lastIndexOf("/"));
const { data: leftovers } = await admin.storage.from("request-media").list(draftFolder);
assert.equal((leftovers ?? []).length, 0, "les fichiers du brouillon doivent être effacés");
log("Brouillon abandonné depuis plus de 30 jours supprimé, vidéo comprise");

console.log(`\nTest d'intégration du stockage réussi (${step} vérifications).`);
