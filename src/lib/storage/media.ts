import "server-only";
import type { ServerSupabase } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const MEDIA_BUCKET = "request-media";
/** Durée de validité des liens de lecture des vidéos (secondes). */
export const MEDIA_URL_TTL = 10 * 60;

/**
 * URL de lecture temporaire d'une vidéo ou d'une image, créée avec la session
 * de l'utilisateur : la règle de stockage n'autorise que les membres de
 * l'entreprise propriétaire du dossier. Retourne null si l'accès est refusé.
 */
export async function signedMediaUrl(supabase: ServerSupabase, path: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from(MEDIA_BUCKET).createSignedUrl(path, MEDIA_URL_TTL);
  if (error) return null;
  return data.signedUrl;
}

/** URL d'envoi signée pour un emplacement déjà réservé en base (clé secrète requise). */
export async function createUploadUrl(path: string) {
  const admin = createAdminClient();
  if (!admin) throw new Error("SUPABASE_SECRET_KEY manquante : l'envoi de vidéos n'est pas configuré.");
  const { data, error } = await admin.storage.from(MEDIA_BUCKET).createSignedUploadUrl(path);
  if (error || !data) throw new Error(`Impossible de préparer l'envoi : ${error?.message ?? "réponse vide"}`);
  return { signedUrl: data.signedUrl, token: data.token, path: data.path };
}

/** Taille réelle d'un fichier du stockage, ou null s'il n'existe pas. */
export async function storedObjectSize(path: string): Promise<number | null> {
  const admin = createAdminClient();
  if (!admin) throw new Error("SUPABASE_SECRET_KEY manquante.");
  const slash = path.lastIndexOf("/");
  const { data, error } = await admin.storage.from(MEDIA_BUCKET).list(path.slice(0, slash), { search: path.slice(slash + 1), limit: 1 });
  if (error) throw new Error(`Lecture du stockage impossible : ${error.message}`);
  const file = data?.find((f) => f.name === path.slice(slash + 1));
  const size = (file?.metadata as { size?: number } | undefined)?.size;
  return typeof size === "number" ? size : null;
}
