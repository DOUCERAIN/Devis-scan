import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { publicEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { createUploadUrl, storedObjectSize } from "@/lib/storage/media";
import type { Database } from "@/lib/supabase/database.types";

/**
 * Parcours du particulier sans compte — couche serveur (phase 3).
 *
 * Le particulier est identifié par un jeton secret remis à la création de sa
 * demande. Les opérations passent par des fonctions SQL qui vérifient ce jeton
 * (voir supabase/migrations/*_public_request_flow.sql). La clé secrète n'est
 * utilisée que pour les URL d'envoi signées et la confirmation des envois.
 *
 * L'interface (page /d/[slug], tournage, compression, extraction d'images)
 * sera construite en phase 3 au-dessus de ces fonctions.
 */

function anonClient() {
  const env = publicEnv();
  return createSupabaseClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

export type PublicRequestPayload = {
  customer: { full_name: string; email: string; phone?: string | null };
  moving_date?: string | null;
  moving_date_flexible?: boolean;
  customer_notes?: string | null;
  origin: Record<string, string | number | null | undefined>;
  destination?: Record<string, string | number | null | undefined>;
};

export async function getPublicCompany(slug: string) {
  const { data, error } = await anonClient().rpc("get_public_company", { company_slug: slug });
  if (error) throw error;
  return data?.[0] ?? null;
}

export async function createPublicRequest(slug: string, payload: PublicRequestPayload) {
  const { data, error } = await anonClient().rpc("create_public_request", { company_slug: slug, payload });
  if (error) throw error;
  const row = data?.[0];
  if (!row) throw new Error("Création de la demande impossible.");
  return { requestId: row.request_id, accessToken: row.access_token };
}

export async function addRoom(accessToken: string, name: string, kind?: string) {
  const { data, error } = await anonClient().rpc("add_public_room", { access_token: accessToken, room_name: name, room_kind: kind });
  if (error) throw error;
  return data;
}

/** Réserve un emplacement et renvoie l'URL signée où le navigateur envoie la vidéo. */
export async function prepareVideoUpload(accessToken: string, roomId: string, mimeType: string, sizeBytes: number) {
  const { data, error } = await anonClient().rpc("register_public_video", {
    access_token: accessToken,
    room_id: roomId,
    mime_type: mimeType,
    size_bytes: sizeBytes,
  });
  if (error) throw error;
  const slot = data?.[0];
  if (!slot) throw new Error("Réservation de l'emplacement impossible.");
  const upload = await createUploadUrl(slot.storage_path);
  return { videoId: slot.video_id, path: slot.storage_path, signedUrl: upload.signedUrl, uploadToken: upload.token };
}

/** Vérifie que le fichier est réellement dans le stockage avant de le déclarer envoyé. */
export async function confirmVideoUpload(accessToken: string, videoId: string, path: string, durationSeconds?: number) {
  const size = await storedObjectSize(path);
  if (size === null) throw new Error("La vidéo n'a pas été reçue.");
  const admin = createAdminClient();
  if (!admin) throw new Error("SUPABASE_SECRET_KEY manquante.");
  const { error } = await admin.rpc("mark_video_uploaded", {
    access_token: accessToken,
    video_id: videoId,
    actual_size: size,
    duration_seconds: durationSeconds,
  });
  if (error) throw error;
  return size;
}

export async function submitRequest(accessToken: string) {
  const { error } = await anonClient().rpc("submit_public_request", { access_token: accessToken });
  if (error) throw error;
}
