"use client";

/**
 * Envoi des fichiers vers le stockage privé Supabase.
 *
 * Vidéos : protocole TUS (envoi reprenable) sur le point « upload/resumable/sign »,
 * avec l'autorisation d'envoi délivrée par notre serveur pour CE chemin uniquement.
 * Le fichier part par morceaux de 6 Mo ; après une coupure, on demande au serveur
 * la position déjà reçue et on reprend à partir de là (dans la même session de page).
 */

const CHUNK = 6 * 1024 * 1024;

export class UploadError extends Error {
  constructor(message: string, readonly retryable: boolean) {
    super(message);
  }
}

export type UploadTarget = { supabaseUrl: string; publishableKey: string; bucket: string; path: string; token: string };

function b64(value: string) {
  return btoa(unescape(encodeURIComponent(value)));
}

function headers(t: UploadTarget): Record<string, string> {
  return { apikey: t.publishableKey, "x-signature": t.token, "Tus-Resumable": "1.0.0" };
}

async function createUpload(t: UploadTarget, size: number, contentType: string): Promise<string> {
  let res: Response;
  try {
    res = await fetch(`${t.supabaseUrl}/storage/v1/upload/resumable/sign`, {
      method: "POST",
      headers: {
        ...headers(t),
        "Upload-Length": String(size),
        "Upload-Metadata": `bucketName ${b64(t.bucket)},objectName ${b64(t.path)},contentType ${b64(contentType)},cacheControl ${b64("3600")}`,
      },
    });
  } catch {
    throw new UploadError("Connexion impossible. Vérifiez votre réseau puis réessayez.", true);
  }
  const location = res.headers.get("location");
  if (res.status !== 201 || !location) {
    throw new UploadError(res.status === 413 ? "Fichier trop volumineux." : "L'envoi a été refusé. Recommencez.", res.status >= 500);
  }
  return location;
}

async function currentOffset(t: UploadTarget, location: string): Promise<number> {
  const res = await fetch(location, { method: "HEAD", headers: headers(t) });
  if (!res.ok) throw new UploadError("L'envoi interrompu ne peut pas être repris. Recommencez.", false);
  return Number(res.headers.get("upload-offset") ?? 0);
}

function patch(t: UploadTarget, location: string, chunk: Blob, offset: number, onBytes: (sent: number) => void, signal?: AbortSignal) {
  return new Promise<number>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PATCH", location);
    for (const [k, v] of Object.entries(headers(t))) xhr.setRequestHeader(k, v);
    xhr.setRequestHeader("Upload-Offset", String(offset));
    xhr.setRequestHeader("Content-Type", "application/offset+octet-stream");
    xhr.upload.onprogress = (e) => onBytes(e.loaded);
    xhr.onload = () => {
      if (xhr.status === 204) resolve(Number(xhr.getResponseHeader("upload-offset") ?? offset + chunk.size));
      else reject(new UploadError("Le serveur a refusé une partie de l'envoi.", xhr.status >= 500 || xhr.status === 409));
    };
    xhr.onerror = () => reject(new UploadError("Connexion interrompue.", true));
    xhr.ontimeout = () => reject(new UploadError("Connexion trop lente.", true));
    signal?.addEventListener("abort", () => { xhr.abort(); reject(new UploadError("Envoi annulé.", false)); });
    xhr.send(chunk);
  });
}

export type ResumableState = { location?: string };

/**
 * Envoie `blob` ; `state.location` est conservé pour reprendre après une erreur.
 * Jusqu'à 4 reprises automatiques en cas de coupure, puis l'erreur est remontée
 * (l'utilisateur peut relancer : l'envoi repart de la position déjà reçue).
 */
export async function uploadResumable(
  t: UploadTarget, blob: Blob, contentType: string, state: ResumableState,
  onProgress: (sent: number, total: number) => void, signal?: AbortSignal,
) {
  state.location ??= await createUpload(t, blob.size, contentType);
  let offset = state.location ? await currentOffset(t, state.location).catch(() => 0) : 0;
  let attempts = 0;
  while (offset < blob.size) {
    const chunk = blob.slice(offset, Math.min(offset + CHUNK, blob.size));
    try {
      offset = await patch(t, state.location, chunk, offset, (sent) => onProgress(offset + sent, blob.size), signal);
      attempts = 0;
      onProgress(offset, blob.size);
    } catch (error) {
      if (!(error instanceof UploadError) || !error.retryable || attempts >= 4) throw error;
      attempts++;
      await new Promise((r) => setTimeout(r, 1000 * 2 ** attempts));
      offset = await currentOffset(t, state.location).catch(() => offset);
    }
  }
}

/** Envoi simple d'un petit fichier (image extraite) sur une URL d'envoi signée. */
export async function uploadSmall(t: UploadTarget, blob: Blob, contentType: string) {
  const url = `${t.supabaseUrl}/storage/v1/object/upload/sign/${t.bucket}/${t.path.split("/").map(encodeURIComponent).join("/")}?token=${encodeURIComponent(t.token)}`;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, { method: "PUT", headers: { apikey: t.publishableKey, "content-type": contentType, "x-upsert": "false" }, body: blob });
      if (res.ok) return;
      if (res.status < 500) throw new UploadError("Image refusée.", false);
    } catch (error) {
      if (error instanceof UploadError && !error.retryable) throw error;
    }
    await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
  }
  throw new UploadError("Envoi d'une image impossible.", true);
}
