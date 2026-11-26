import "server-only";
import { createHash } from "node:crypto";
import { cache } from "react";
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
export type DraftVideo = { id: string; kind?: "video" | "photo"; status: string; size_bytes: number | null; duration_seconds: number | null; processing: string | null; original_size_bytes: number | null; frames: number };
export type DraftRoom = { id: string; name: string; room_type: string | null; description: string | null; videos: DraftVideo[] };
export type DraftCustomer = {
  full_name: string; email: string | null; phone: string | null; type: "individual" | "company";
  first_name: string | null; last_name: string | null; company_name: string | null; siret: string | null;
  privacy_accepted: boolean; marketing_consent: boolean;
};
export type Draft = {
  id: string; status: string; submitted_at: string | null;
  moving_date: string | null; alternative_moving_date: string | null; alternative_moving_dates: string[]; moving_date_flexible: boolean; customer_notes: string | null;
  inventory_method: "video" | "manual" | null;
  /** Cartons supplémentaires déclarés par le client (null : étape non remplie ; 0 accepté). */
  extra_boxes: number | null;
  customer: DraftCustomer | null;
  dwellings: Partial<Record<"origin" | "destination", DraftDwelling>>;
  /** Pièces filmées (les catégories de l'inventaire manuel n'en font pas partie). */
  rooms: DraftRoom[];
  item_count: number;
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

/** Pièce technique « Mon logement » qui reçoit toutes les vidéos et photos (le client ne déclare aucune pièce). */
export async function ensureMediaRoom(token: string): Promise<string> {
  const { data, error } = await anonClient().rpc("public_media_room", { access_token: token });
  if (error) throw error;
  return data;
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
export async function prepareVideoUpload(token: string, roomId: string, mimeType: string, sizeBytes: number, meta: VideoMeta & { media_kind?: "video" | "photo" }) {
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
    .select("id, storage_path, mime_type, status, media_kind")
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

export const MAX_PHOTO_BYTES = 10 * 1024 * 1024;

/**
 * Vérifie une photo réellement reçue (présence, taille, format JPEG d'après les premiers octets), la déclare
 * envoyée et en fait sa propre image d'analyse. Fichier non conforme : effacé et refusé.
 */
export async function confirmPhotoUpload(token: string, photo: { id: string; path: string; width?: number; height?: number }) {
  const size = await storedObjectSize(photo.path);
  if (size === null) throw new InvalidUploadError("La photo n'a pas été reçue. Relancez l'envoi.");
  const head = await readObjectHead(photo.path, 4);
  const jpeg = head.length >= 3 && head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff;
  if (size > MAX_PHOTO_BYTES || !jpeg) {
    await removeObjects([photo.path]);
    await anonClient().rpc("discard_public_video", { access_token: token, video_id: photo.id });
    throw new InvalidUploadError(size > MAX_PHOTO_BYTES ? "Cette photo est trop lourde (10 Mo maximum)." : "Ce fichier n'est pas une photo valide.");
  }
  const admin = adminClient();
  const { error } = await admin.rpc("mark_video_uploaded", { access_token: token, video_id: photo.id, actual_size: size, width: photo.width, height: photo.height });
  if (error) throw error;
  const { error: frameError } = await admin.rpc("add_public_photo_frame", { access_token: token, video_id: photo.id, width: photo.width, height: photo.height });
  if (frameError) throw frameError;
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

/** Envoie la demande ; renvoie le jeton de consultation du devis (remis une seule fois). */
export async function submitDraft(token: string): Promise<string> {
  const { data, error } = await anonClient().rpc("submit_public_request", { access_token: token });
  if (error) throw error;
  return data;
}

/**
 * Ligne de devis vue par le CLIENT : prestation et description, sans prix (les montants ligne à ligne ne
 * quittent pas la base, get_public_quote_view). Le déménageur lit les lignes complètes dans son espace.
 */
export type QuoteLineView = { code: string; label: string; detail: string; quantity?: number; unit?: string; unit_price_cents?: number; amount_cents?: number };
export type PublicQuote = {
  id: string; version: number; status: string; kind: "formal" | "estimate"; origin: string; created_at: string; valid_until: string | null;
  lines: QuoteLineView[]; prices_hidden?: boolean; total_ht_cents: number; vat_cents: number; total_ttc_cents: number; vat_rate: number;
  distance_km: number | null; distance_method: "route" | "estimate" | null;
  volume: { confirmedM3: number; toVerifyM3: number; potentialM3: number; estimatedM3: number; maxM3: number; billable_m3: number; needsHumanReview: boolean; upper_total_ttc_cents: number | null; rooms: { name: string; estimatedM3: number; potentialM3: number }[] };
  company: Record<string, string | number | boolean | null>;
  request: { reference: string; moving_date: string | null; alternative_moving_date: string | null; moving_date_flexible: boolean; customer: { full_name: string; email: string | null; phone: string | null } | null; origin: Record<string, unknown> | null; destination: Record<string, unknown> | null };
  inventory: { name: string; room: string; quantity: number; unit_volume_m3: number; bucket: string; level: string }[];
  assumptions: string[]; review_reasons?: string[]; changes: unknown; sent_at: string | null; accepted_at: string | null;
  refused_at?: string | null; amends_quote_id?: string | null; supersedes_id?: string | null;
};
export type PublicCorrection = {
  outcome: "corrected_same_terms" | "corrected_new_version" | "corrected_amendment"; reason: string | null;
  changes: { kind: "added" | "removed" | "corrected"; label: string }[]; created_at: string;
  volume_before_m3: number | null; volume_after_m3: number | null; total_before_cents: number | null; total_after_cents: number | null;
};
export type PublicQuoteView = {
  status: string; submitted_at: string | null; customer_validated_at?: string | null; corrections?: PublicCorrection[];
  analysis: { status: string; stage: string | null; rooms_total: number | null; rooms_done: number | null; simulated: boolean; error_code: string | null } | null;
  quotes: PublicQuote[];
};

/** Suivi de l'analyse et devis, à partir du jeton de consultation ou du jeton d'accès (cookie). */
export async function getQuoteView(token: string): Promise<PublicQuoteView | null> {
  if (!/^[0-9a-f]{64}$/.test(token)) return null;
  const { data, error } = await anonClient().rpc("get_public_quote_view", { token });
  if (error) return null;
  return data as unknown as PublicQuoteView;
}

/** Identifiant interne de la demande (serveur uniquement, pour lancer l'analyse). */
export async function requestIdForViewToken(viewToken: string): Promise<string | null> {
  const hash = createHash("sha256").update(viewToken).digest("hex");
  const { data } = await adminClient().from("quote_requests").select("id").eq("view_token_hash", hash).maybeSingle();
  return data?.id ?? null;
}

export async function getPublicOptions(slug: string) {
  const { data } = await anonClient().rpc("get_public_company_options", { company_slug: slug });
  return data ?? [];
}

export async function setDraftOptions(token: string, options: { option_id: string; quantity: number }[]) {
  const { error } = await anonClient().rpc("set_public_options", { access_token: token, options: options as unknown as Json });
  if (error) throw error;
}

export async function getDraftOptions(token: string): Promise<{ option_id: string; quantity: number }[]> {
  const { data } = await anonClient().rpc("get_public_selected_options", { access_token: token });
  return Array.isArray(data) ? (data as { option_id: string; quantity: number }[]) : [];
}

export type PublicInventoryItem = {
  id: string; name: string; room: string; room_id: string | null; room_position: number; quantity: number;
  category: string | null; catalog_key: string | null; source: "ai" | "customer" | "mover"; unit_volume_m3: number;
  volume_source: string | null; size_class: string | null; dims: { w: number; d: number; h: number } | null; comment: string | null;
  possible_duplicate: boolean; duplicate_reason: string | null;
  duplicate_of: { id: string; name: string; room: string } | null;
  customer_decision: "distinct" | "same" | null;
  frames: string[]; duplicate_frames: string[];
};
export type PublicInventory = {
  status: string; inventory_method: "video" | "manual" | null; customer_validated_at: string | null;
  /** Cartons supplémentaires déclarés (null : étape non remplie). */
  extra_boxes: number | null;
  rooms: { id: string; name: string; category: string | null }[]; items: PublicInventoryItem[];
};

/**
 * Inventaire à valider par le client (jeton vérifié en base). Les images des éléments à vérifier sont
 * servies par des liens temporaires (10 min) créés côté serveur : les chemins viennent de la fonction SQL,
 * qui ne renvoie que les images de cette demande.
 */
export async function getPublicInventory(token: string): Promise<{ inventory: PublicInventory; imageUrls: Map<string, string> } | null> {
  if (!/^[0-9a-f]{64}$/.test(token)) return null;
  const { data, error } = await anonClient().rpc("get_public_inventory", { token });
  if (error || !data) return null;
  const inventory = data as unknown as PublicInventory;
  const paths = [...new Set(inventory.items.filter((i) => i.possible_duplicate).flatMap((i) => [...i.frames, ...i.duplicate_frames]))];
  const imageUrls = new Map<string, string>();
  if (paths.length > 0) {
    const { data: signed } = await adminClient().storage.from("request-media").createSignedUrls(paths, 10 * 60);
    for (const s of signed ?? []) if (s.path && s.signedUrl && !s.error) imageUrls.set(s.path, s.signedUrl);
  }
  return { inventory, imageUrls };
}

/** Validation de l'inventaire par le client (toutes les réponses + avertissement accepté, contrôlés en base). */
export async function validateInventory(token: string, decisions: Record<string, "distinct" | "same">, acknowledgement: string) {
  const { error } = await anonClient().rpc("validate_public_inventory", { token, decisions: decisions as unknown as Json, acknowledgement });
  if (error) throw error;
}

// -----------------------------------------------------------------------------
// Inventaire saisi ou corrigé par le client (jeton vérifié en base à chaque appel)
// -----------------------------------------------------------------------------

export type CustomerItemInput = {
  catalog_key?: string; label?: string; category?: string; room_id?: string; quantity: number;
  width_cm?: number; depth_cm?: number; height_cm?: number; size?: string; comment?: string;
};

/** Ajoute un objet ; le volume (catalogue, dimensions ou objet comparable) est calculé et justifié en base. */
export async function addInventoryItem(token: string, item: CustomerItemInput): Promise<string> {
  const { data, error } = await anonClient().rpc("public_inventory_add", { token, item: item as unknown as Json });
  if (error) throw error;
  return data;
}

export async function setInventoryQuantity(token: string, itemId: string, quantity: number) {
  const { error } = await anonClient().rpc("public_inventory_update", { token, item_id: itemId, new_quantity: quantity });
  if (error) throw error;
}

export async function removeInventoryItem(token: string, itemId: string) {
  const { error } = await anonClient().rpc("public_inventory_remove", { token, item_id: itemId });
  if (error) throw error;
}

/** Étape des cartons : nombre de cartons supplémentaires (0 accepté), reporté dans l'inventaire en base. */
export async function setExtraBoxes(token: string, boxes: number) {
  const { error } = await anonClient().rpc("public_set_extra_boxes", { token, boxes });
  if (error) throw error;
}

/** Pièce supplémentaire de l'inventaire (Chambre 2, buanderie…). */
export async function addInventoryRoom(token: string, baseCategory: string, name: string): Promise<string> {
  const { data, error } = await anonClient().rpc("public_inventory_add_room", { token, base_category: baseCategory, room_name: name });
  if (error) throw error;
  return data;
}

/** Inventaire (sans images) lu avec le jeton d'accès du brouillon ou le jeton de consultation. */
export async function readInventory(token: string): Promise<PublicInventory | null> {
  if (!/^[0-9a-f]{64}$/.test(token)) return null;
  const { data, error } = await anonClient().rpc("get_public_inventory", { token });
  if (error || !data) return null;
  return data as unknown as PublicInventory;
}

/** Envoi d'une demande « inventaire manuel » : validée par le client dans la même opération. */
export async function submitManualDraft(token: string, acknowledgement: string): Promise<string> {
  const { data, error } = await anonClient().rpc("submit_public_manual_request", { access_token: token, acknowledgement });
  if (error) throw error;
  return data;
}

/** Analyse impossible : le client complète lui-même son inventaire. */
export async function resumeManually(viewToken: string) {
  const { error } = await anonClient().rpc("public_resume_manual", { token: viewToken });
  if (error) throw error;
}

export type { CatalogChoice } from "@/lib/inventory/manual";

/** Catalogue proposé au client (lecture publique) : nom, catégorie, synonymes, volume de déménagement. */
export const getCustomerCatalog = cache(async () => {
  const { data, error } = await anonClient().from("furniture_catalog").select("id, name, category, synonyms, moving_volume_avg").order("name");
  if (error) throw error;
  return (data ?? []).map((r) => ({ id: r.id, name: r.name, category: r.category, synonyms: r.synonyms ?? [], volume: r.moving_volume_avg === null ? null : Number(r.moving_volume_avg) }));
});
