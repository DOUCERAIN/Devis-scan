import "server-only";
import type { ServerSupabase } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const MEDIA_BUCKET = "request-media";
/** Durée de validité des liens de lecture des vidéos et images (secondes). */
export const MEDIA_URL_TTL = 10 * 60;

function admin() {
  const client = createAdminClient();
  if (!client) throw new Error("SUPABASE_SECRET_KEY manquante : le stockage des vidéos n'est pas configuré.");
  return client;
}

/**
 * URL de lecture temporaire créée avec la session de l'utilisateur : la règle
 * de stockage n'autorise que les membres de l'entreprise propriétaire du dossier.
 * Retourne null si l'accès est refusé.
 */
export async function signedMediaUrl(supabase: ServerSupabase, path: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from(MEDIA_BUCKET).createSignedUrl(path, MEDIA_URL_TTL);
  if (error) return null;
  return data.signedUrl;
}

/** Plusieurs URL de lecture en un seul appel (images extraites). */
export async function signedMediaUrls(supabase: ServerSupabase, paths: string[]): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  if (paths.length === 0) return result;
  const { data, error } = await supabase.storage.from(MEDIA_BUCKET).createSignedUrls(paths, MEDIA_URL_TTL);
  if (error || !data) return result;
  for (const item of data) if (item.path && item.signedUrl && !item.error) result.set(item.path, item.signedUrl);
  return result;
}

/** Autorisation d'envoi pour un emplacement déjà réservé en base (valable 2 heures, liée à ce chemin). */
export async function createUploadUrl(path: string) {
  const { data, error } = await admin().storage.from(MEDIA_BUCKET).createSignedUploadUrl(path);
  if (error || !data) throw new Error(`Impossible de préparer l'envoi : ${error?.message ?? "réponse vide"}`);
  return { signedUrl: data.signedUrl, token: data.token, path: data.path };
}

/** Taille réelle d'un fichier du stockage, ou null s'il n'existe pas. */
export async function storedObjectSize(path: string): Promise<number | null> {
  const slash = path.lastIndexOf("/");
  const name = path.slice(slash + 1);
  const { data, error } = await admin().storage.from(MEDIA_BUCKET).list(path.slice(0, slash), { search: name, limit: 10 });
  if (error) throw new Error(`Lecture du stockage impossible : ${error.message}`);
  const size = (data?.find((f) => f.name === name)?.metadata as { size?: number } | undefined)?.size;
  return typeof size === "number" ? size : null;
}

/** Premiers octets d'un fichier (contrôle du format réel). */
export async function readObjectHead(path: string, bytes = 16): Promise<Uint8Array> {
  const { data, error } = await admin().storage.from(MEDIA_BUCKET).createSignedUrl(path, 60);
  if (error || !data) throw new Error("Lecture du fichier impossible.");
  const res = await fetch(data.signedUrl, { headers: { Range: `bytes=0-${bytes - 1}` } });
  if (!res.ok) throw new Error(`Lecture du fichier impossible (${res.status}).`);
  return new Uint8Array(await res.arrayBuffer()).slice(0, bytes);
}

/** Suppression réelle de fichiers du stockage privé. */
export async function removeObjects(paths: string[]) {
  if (paths.length === 0) return;
  const { error } = await admin().storage.from(MEDIA_BUCKET).remove(paths);
  if (error) throw new Error(`Suppression impossible : ${error.message}`);
}

/** Supprime du stockage les vidéos marquées (abandon par le client, échéance RGPD) puis les marque supprimées. */
export async function purgeDueVideos(maxRounds = 10): Promise<{ purged: number; failed: number }> {
  const client = admin();
  let purged = 0;
  let failed = 0;
  for (let round = 0; round < maxRounds; round++) {
    const { data: due, error } = await client.rpc("claim_videos_for_purge", { max_items: 100 });
    if (error) throw new Error("Lecture des vidéos à purger impossible");
    if (!due || due.length === 0) break;
    const paths = due.flatMap((v) => [v.storage_path, ...(v.frame_paths ?? [])]);
    const { error: removeError } = await client.storage.from(MEDIA_BUCKET).remove(paths);
    if (removeError) {
      console.error("[purge] storage.remove", removeError.message);
      failed += due.length;
      break;
    }
    const { data: count, error: markError } = await client.rpc("mark_videos_purged", { video_ids: due.map((v) => v.video_id) });
    if (markError) throw new Error("Mise à jour impossible après suppression");
    purged += count ?? 0;
    if (due.length < 100) break;
  }
  return { purged, failed };
}

/** Supprime les brouillons jamais envoyés depuis plus de 30 jours, fichiers compris. */
export async function purgeAbandonedDrafts(): Promise<number> {
  const client = admin();
  const { data: drafts, error } = await client.rpc("claim_abandoned_drafts", { max_items: 50 });
  if (error) throw new Error("Lecture des brouillons abandonnés impossible");
  if (!drafts || drafts.length === 0) return 0;
  const paths = drafts.flatMap((d) => d.file_paths ?? []);
  if (paths.length) await removeObjects(paths);
  const { data: removed, error: delError } = await client.rpc("delete_abandoned_drafts", { request_ids: drafts.map((d) => d.request_id) });
  if (delError) throw new Error("Suppression des brouillons impossible");
  return removed ?? 0;
}
