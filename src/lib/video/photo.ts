"use client";

/**
 * Photos importées par le particulier (parcours v3). Chaque photo est décodée par le navigateur (JPEG, PNG,
 * WebP, HEIC sur iPhone quand Safari sait l'afficher), réduite à 1 600 px sur le grand côté et réencodée en
 * JPEG : format accepté par l'analyse, poids maîtrisé (10 Mo au plus côté serveur), métadonnées (dont la
 * position GPS) supprimées. L'original reste sur l'appareil du client.
 */
export const PHOTO_MAX_SIDE = 1600;
export const PHOTO_QUALITY = 0.85;
export const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
/** Fichier d'origine refusé au-delà (photos panoramiques ou RAW). */
export const MAX_SOURCE_PHOTO_BYTES = 40 * 1024 * 1024;

export class PhotoProcessingError extends Error {}

export type PreparedPhoto = { blob: Blob; width: number; height: number; originalMimeType: string; originalSize: number };

export function photoTargetSize(width: number, height: number, maxSide = PHOTO_MAX_SIDE): { width: number; height: number } {
  const scale = Math.min(1, maxSide / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

async function decode(file: Blob): Promise<{ source: CanvasImageSource; width: number; height: number; close: () => void }> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" } as ImageBitmapOptions);
      return { source: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close() };
    } catch {
      // Repli sur <img> (certains navigateurs décodent le HEIC seulement ainsi).
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    await img.decode();
    return { source: img, width: img.naturalWidth, height: img.naturalHeight, close: () => URL.revokeObjectURL(url) };
  } catch {
    URL.revokeObjectURL(url);
    throw new PhotoProcessingError("Cette image ne peut pas être lue sur cet appareil (formats acceptés : JPEG, PNG, WebP, HEIC).");
  }
}

export async function preparePhoto(file: File | Blob): Promise<PreparedPhoto> {
  if (file.size > MAX_SOURCE_PHOTO_BYTES) throw new PhotoProcessingError("Cette photo est trop lourde (40 Mo maximum).");
  const image = await decode(file);
  try {
    const { width, height } = photoTargetSize(image.width, image.height);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new PhotoProcessingError("Traitement de la photo impossible sur cet appareil.");
    ctx.drawImage(image.source, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", PHOTO_QUALITY));
    if (!blob) throw new PhotoProcessingError("Traitement de la photo impossible sur cet appareil.");
    if (blob.size > MAX_PHOTO_BYTES) throw new PhotoProcessingError("Cette photo reste trop lourde après réduction.");
    return { blob, width, height, originalMimeType: file.type || "image", originalSize: file.size };
  } finally {
    image.close();
  }
}
