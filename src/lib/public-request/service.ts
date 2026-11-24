import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { publicEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { createUploadUrl, readObjectHead, removeObjects, storedObjectSize, purgeDueVideos } from "@/lib/storage/media";
import { containerMatchesMime, detectVideoContainer, MAX_VIDEO_BYTES } from "@/lib/video/signature";
import type { Database, Json } from "@/lib/supabase/database.types";

/**
 * Parcours du particulier sans compte — couche serveur.
 * Toutes les opérations passent par des fonctions SQL qui vérifient le jeton
 * secret de la demande. La clé secrète (createAdminClient) ne sert qu'aux
 * autorisations d'envoi, aux vérifications de fichiers et aux suppressions.
 */

function anonClient() {
  const env = publicEnv();
  return createSupabaseClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

function adminClient() {
  const admin = createAdminClient();
  if (!admin) throw new Error("SUPABASE_SECRET_KEY manquante : l'envoi de vidéos n'est pas configuré.");
  return admin;
}

export type PublicCompany = { id: string; name: string; slug: string; logo_path: string | null; brand_color: string | null; phone: string | null; email: string | null; website: string | null };

export type DraftDwelling = {
  address_line: string | null; postal_code: string | null; city: string | null; latitude: number | null; longitude: number | null;
  housing_type: string | null; surface_m2: number | null; room_count: number | null; floor: number | null; elevator: string | null;
  carrying_distance_m: number | null; parking_notes: string | null; access_notes: string | null;
};
export type DraftVideo = { id: string; status: string; size_bytes: number | null; duration_seconds: number | null; processing: string | null; original_size_bytes: number | null; frames: number };
export type DraftRoom = { id: string; name: string; room_type: string | null; description: string | null; videos: DraftVideo[] };
export type Draft = {
  id: string; status: string; submitted_at: string | null;
  moving_date: string | null; alternative_moving_date: string | null; moving_date_flexible: boolean; customer_notes: string | null;
  customer: { full_name: string; email: string | null; phone: string | null } | null;
  dwellings: Partial<Record<"origin" | "destination", DraftDwelling>>;
  rooms: DraftRoom[];
};

export async function getPublicCompany(slug: string): Promise<PublicCompany | null> {
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) return null;
  const { data, error } = await anonClient().rpc("get_public_company", { company_slug: slug });
  if (error) throw error;
  return (data?.[0] as PublicCompany | undefined) ?? null;
}

export async function getDraft(token: string): Promise<Draft> {
  const { data, error } = await anonClient().rpc("get_public_request", { access_token: token });
  if (error) throw error;
  return data as unknown as Draft;
}

export async function createDraft(slug: string, payload: Json) {
  const { data, error } = await anonClient().rpc("create_public_request", { company_slug: slug, payload });
  if (error) throw error;
  const row = data?.[0];
  if (!row) throw new Error("Création de la demande impossible.");
  return row.access_token;
}

export async function updateDraft(token: string, payload: Json) {
  const { error } = await anonClient().rpc("update_public_request", { access_token: token, payload });
  if (error) throw error;
}

export async function addRoom(token: string, name: string, kind: string | null, description: string | null) {
  const { data, error } = await anonClient().rpc("add_public_room", {
    access_token: token, room_name: name, room_kind: kind ?? undefined, room_description: description ?? undefined,
  });
  if (error) throw error;
  return data;
}

export async function updateRoom(token: string, roomId: string, name: string, kind: string | null, description: string | null) {
  const { error } = await anonClient().rpc("update_public_room", {
    access_token: token, room_id: roomId, room_name: name, room_kind: kind ?? undefined, room_description: description ?? undefined,
  });
  if (error) throw error;
}

/** Supprime une pièce ; ses vidéos sont d'abord retirées et effacées du stockage. */
export async function removeRoom(token: string, room: DraftRoom) {
  for (const video of room.videos) await discardVideo(token, video.id);
  const { error } = await anonClient().rpc("remove_public_room", { access_token: token, room_id: room.id });
  if (error) throw error;
}

export type VideoMeta = {
  capture_source: "camera" | "native_camera" | "gallery";
  processing: "compressed" | "original";
  encoder?: string;
  original_size_bytes?: number;
  original_mime_type?: string;
  original_width?: number;
  original_height?: number;
  original_duration_seconds?: number;
};

/** Réserve l'emplacement et délivre l'autorisation d'envoi (liée à ce seul chemin). */
export async function prepareVideoUpload(token: string, roomId: string, mimeType: string, sizeBytes: number, meta: VideoMeta) {
  const { data, error } = await anonClient().rpc("register_public_video", {
    access_token: token, room_id: roomId, mime_type: mimeType, size_bytes: sizeBytes, meta: meta as unknown as Json,
  });
  if (error) throw error;
  const slot = data?.[0];
  if (!slot) throw new Error("Réservation de l'emplacement impossible.");
  const upload = await createUploadUrl(slot.storage_path);
  return { videoId: slot.video_id, path: slot.storage_path, uploadToken: upload.token };
}

export class InvalidUploadError extends Error {}

/** Chemin et état d'une vidéo, relus en base pour la demande de ce jeton (jamais fournis par le navigateur). */
export async function videoForDraft(token: string, videoId: string) {
  const draft = await getDraft(token);
  const { data, error } = await adminClient()
    .from("room_videos")
    .select("id, storage_path, mime_type, status")
    .eq("id", videoId)
    .eq("request_id", draft.id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** Vérifie le fichier réellement reçu (présence, taille, format) avant de le déclarer envoyé. */
export async function confirmVideoUpload(
  token: string,
  video: { id: string; path: string; mimeType: string; durationSeconds?: number; width?: number; height?: number },
) {
  const size = await storedObjectSize(video.path);
  if (size === null) throw new InvalidUploadError("La vidéo n'a pas été reçue. Relancez l'envoi.");
  const head = await readObjectHead(video.path, 16);
  if (size > MAX_VIDEO_BYTES || !containerMatchesMime(detectVideoContainer(head), video.mimeType)) {
    await removeObjects([video.path]);
    await anonClient().rpc("discard_public_video", { access_token: token, video_id: video.id });
    throw new InvalidUploadError(size > MAX_VIDEO_BYTES ? "Cette vidéo est trop lourde (50 Mo maximum)." : "Ce fichier n'est pas une vidéo valide.");
  }
  const { error } = await adminClient().rpc("mark_video_uploaded", {
    access_token: token, video_id: video.id, actual_size: size,
    duration_seconds: video.durationSeconds, width: video.width, height: video.height,
  });
  if (error) throw error;
  return size;
}

/** Retire une vidéo (supprimer / refaire) et efface immédiatement le fichier et ses images. */
export async function discardVideo(token: string, videoId: string) {
  const { error } = await anonClient().rpc("discard_public_video", { access_token: token, video_id: videoId });
  if (error) throw error;
  await purgeDueVideos(1);
}

/** Prépare l'envoi des images extraites d'une vidéo (chemins générés par le serveur). */
export async function prepareFrameUploads(token: string, videoId: string, count: number) {
  const draft = await getDraft(token);
  const video = draft.rooms.flatMap((r) => r.videos).find((v) => v.id === videoId);
  if (!video) throw new Error("Unknown video");
  const admin = adminClient();
  const { data: row, error } = await admin.from("room_videos").select("storage_path").eq("id", videoId).eq("request_id", draft.id).single();
  if (error || !row) throw new Error("Unknown video");
  const base = row.storage_path.replace(/\/videos\/[^/]+$/, `/frames/${videoId}/`);
  const slots = [];
  for (let i = 0; i < Math.min(count, 12); i++) {
    const path = `${base}${crypto.randomUUID()}.jpg`;
    const upload = await createUploadUrl(path);
    slots.push({ path, uploadToken: upload.token });
  }
  return slots;
}

/** Enregistre les images effectivement présentes dans le stockage. */
export async function confirmFrames(token: string, videoId: string, frames: Array<{ path: string; capturedAtMs: number; width: number; height: number }>) {
  const present = [];
  for (const f of frames) if ((await storedObjectSize(f.path)) !== null) present.push(f);
  if (present.length === 0) return 0;
  const { data, error } = await adminClient().rpc("add_public_frames", {
    access_token: token,
    video_id: videoId,
    frames: present.map((f) => ({ path: f.path, captured_at_ms: Math.round(f.capturedAtMs), width: f.width, height: f.height })) as unknown as Json,
  });
  if (error) throw error;
  return data ?? 0;
}

export async function submitDraft(token: string) {
  const { error } = await anonClient().rpc("submit_public_request", { access_token: token });
  if (error) throw error;
}
