"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getPublicCompany, confirmFrames, confirmVideoUpload, discardVideo, prepareFrameUploads, prepareVideoUpload, videoForDraft, InvalidUploadError, type VideoMeta } from "@/lib/public-request/service";
import { isExpiredSession, publicErrorMessage } from "@/lib/public-request/errors";
import { readDraftToken } from "@/lib/public-request/session";
import { ACCEPTED_VIDEO_MIME, MAX_VIDEO_BYTES } from "@/lib/video/signature";

/**
 * Actions appelées par l'écran de tournage. Chaque appel retrouve l'entreprise à
 * partir du lien et la demande à partir du cookie : le navigateur ne fournit que
 * des identifiants de pièces / vidéos, vérifiés en base contre ce jeton.
 */

type Result<T> = { ok: true; data: T } | { ok: false; error: string; expired?: boolean };

async function tokenFor(slug: string) {
  const company = await getPublicCompany(slug);
  if (!company) return null;
  return readDraftToken(company.id);
}

function fail(error: unknown, context: string): { ok: false; error: string; expired?: boolean } {
  if (error instanceof InvalidUploadError) return { ok: false, error: error.message };
  return { ok: false, error: publicErrorMessage(error, context), expired: isExpiredSession(error) };
}

const uuid = z.uuid();
const metaSchema = z.object({
  capture_source: z.enum(["camera", "native_camera", "gallery"]),
  processing: z.enum(["compressed", "original"]),
  encoder: z.string().max(80).optional(),
  original_size_bytes: z.number().int().nonnegative().optional(),
  original_mime_type: z.string().max(100).optional(),
  original_width: z.number().int().positive().max(10000).optional(),
  original_height: z.number().int().positive().max(10000).optional(),
  original_duration_seconds: z.number().nonnegative().max(99999).optional(),
});

export async function prepareVideoAction(slug: string, input: { roomId: string; mimeType: string; size: number; meta: VideoMeta }):
  Promise<Result<{ videoId: string; path: string; uploadToken: string }>> {
  const token = await tokenFor(slug);
  if (!token) return { ok: false, error: "Votre session a expiré. Rechargez la page.", expired: true };
  if (!uuid.safeParse(input.roomId).success) return { ok: false, error: "Pièce inconnue." };
  if (!(ACCEPTED_VIDEO_MIME as readonly string[]).includes(input.mimeType)) return { ok: false, error: "Format de vidéo non accepté (MP4, MOV ou WebM)." };
  if (!Number.isInteger(input.size) || input.size <= 0 || input.size > MAX_VIDEO_BYTES) return { ok: false, error: "Cette vidéo est trop lourde (50 Mo maximum)." };
  const meta = metaSchema.safeParse(input.meta);
  if (!meta.success) return { ok: false, error: "Informations de la vidéo invalides." };
  try {
    return { ok: true, data: await prepareVideoUpload(token, input.roomId, input.mimeType, input.size, meta.data) };
  } catch (error) {
    return fail(error, "prepareVideoAction");
  }
}

export async function confirmVideoAction(slug: string, input: { videoId: string; duration?: number; width?: number; height?: number }):
  Promise<Result<{ size: number }>> {
  const token = await tokenFor(slug);
  if (!token) return { ok: false, error: "Votre session a expiré. Rechargez la page.", expired: true };
  if (!uuid.safeParse(input.videoId).success) return { ok: false, error: "Vidéo inconnue." };
  try {
    // Chemin et type relus en base pour la demande de ce jeton.
    const video = await videoForDraft(token, input.videoId);
    if (!video || video.status !== "awaiting_upload" || !video.mime_type) return { ok: false, error: "Vidéo inconnue ou déjà envoyée." };
    const size = await confirmVideoUpload(token, {
      id: video.id, path: video.storage_path, mimeType: video.mime_type,
      durationSeconds: finite(input.duration), width: int(input.width), height: int(input.height),
    });
    revalidatePath(`/d/${slug}`, "layout");
    return { ok: true, data: { size } };
  } catch (error) {
    return fail(error, "confirmVideoAction");
  }
}

export async function prepareFramesAction(slug: string, videoId: string, count: number): Promise<Result<Array<{ path: string; uploadToken: string }>>> {
  const token = await tokenFor(slug);
  if (!token) return { ok: false, error: "Votre session a expiré.", expired: true };
  if (!uuid.safeParse(videoId).success || !Number.isInteger(count) || count < 1 || count > 12) return { ok: false, error: "Demande invalide." };
  try {
    return { ok: true, data: await prepareFrameUploads(token, videoId, count) };
  } catch (error) {
    return fail(error, "prepareFramesAction");
  }
}

const framesSchema = z.array(z.object({
  path: z.string().max(400), capturedAtMs: z.number().nonnegative().max(1e9), width: z.number().int().positive().max(10000), height: z.number().int().positive().max(10000),
})).min(1).max(12);

export async function confirmFramesAction(slug: string, videoId: string, frames: unknown): Promise<Result<{ count: number }>> {
  const token = await tokenFor(slug);
  if (!token) return { ok: false, error: "Votre session a expiré.", expired: true };
  const parsed = framesSchema.safeParse(frames);
  if (!uuid.safeParse(videoId).success || !parsed.success) return { ok: false, error: "Images invalides." };
  try {
    const count = await confirmFrames(token, videoId, parsed.data);
    revalidatePath(`/d/${slug}`, "layout");
    return { ok: true, data: { count } };
  } catch (error) {
    return fail(error, "confirmFramesAction");
  }
}

export async function discardVideoAction(slug: string, videoId: string): Promise<Result<null>> {
  const token = await tokenFor(slug);
  if (!token) return { ok: false, error: "Votre session a expiré.", expired: true };
  if (!uuid.safeParse(videoId).success) return { ok: false, error: "Vidéo inconnue." };
  try {
    await discardVideo(token, videoId);
    revalidatePath(`/d/${slug}`, "layout");
    return { ok: true, data: null };
  } catch (error) {
    return fail(error, "discardVideoAction");
  }
}

function finite(n: unknown) {
  return typeof n === "number" && Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : undefined;
}
function int(n: unknown) {
  return typeof n === "number" && Number.isInteger(n) && n > 0 && n <= 10000 ? n : undefined;
}

/** Lien de lecture temporaire pour que le particulier revoie sa propre vidéo. */
export async function videoPreviewAction(slug: string, videoId: string): Promise<Result<{ url: string }>> {
  const token = await tokenFor(slug);
  if (!token) return { ok: false, error: "Votre session a expiré.", expired: true };
  if (!uuid.safeParse(videoId).success) return { ok: false, error: "Vidéo inconnue." };
  try {
    const video = await videoForDraft(token, videoId);
    if (!video || !["uploaded", "processing", "ready"].includes(video.status)) return { ok: false, error: "Vidéo indisponible." };
    const { createAdminClient } = await import("@/lib/supabase/admin");
    const { data, error } = await createAdminClient()!.storage.from("request-media").createSignedUrl(video.storage_path, 600);
    if (error || !data) return { ok: false, error: "Vidéo indisponible." };
    return { ok: true, data: { url: data.signedUrl } };
  } catch (error) {
    return fail(error, "videoPreviewAction");
  }
}
