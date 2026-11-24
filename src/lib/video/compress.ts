"use client";

import {
  ALL_FORMATS, BlobSource, BufferTarget, CanvasSink, Conversion, Input, Mp4OutputFormat, Output, WebMOutputFormat,
  getFirstEncodableVideoCodec,
} from "mediabunny";
import { ACCEPTED_VIDEO_MIME, MAX_VIDEO_BYTES, detectVideoContainer } from "./signature";
import { laplacianVariance, sampleTimestamps, selectFrames, targetDimensions, type FrameCandidate } from "./frame-selection";

/**
 * Traitement des vidéos dans le navigateur du particulier, avant l'envoi.
 *
 * Compression : réencodage « 720p » (petit côté 720 px), 30 images/s au plus,
 * ≈ 2 Mbit/s, SANS le son (inutile pour l'inventaire, et plus respectueux de la vie
 * privée), avec l'encodeur matériel du navigateur (WebCodecs, via Mediabunny).
 * Si l'appareil ne sait pas encoder, la vidéo d'origine est envoyée telle quelle
 * (si elle respecte la taille maximale). L'original n'est jamais modifié : il reste
 * sur le téléphone ; seules ses caractéristiques sont transmises.
 */

export const TARGET_BITRATE = 2_000_000;
export const MAX_FRAME_RATE = 30;

export class VideoProcessingError extends Error {}

export type OriginalInfo = { size: number; mimeType: string; width?: number; height?: number; duration?: number };

export type PreparedVideo = {
  blob: Blob;
  mimeType: (typeof ACCEPTED_VIDEO_MIME)[number];
  processing: "compressed" | "original";
  encoder?: string;
  width?: number;
  height?: number;
  duration?: number;
  original: OriginalInfo;
};

function mimeFromContainer(head: Uint8Array): PreparedVideo["mimeType"] | null {
  const c = detectVideoContainer(head);
  return c === "webm" ? "video/webm" : c === "quicktime" ? "video/quicktime" : c === "mp4" ? "video/mp4" : null;
}

async function readHead(blob: Blob): Promise<Uint8Array> {
  return new Uint8Array(await blob.slice(0, 16).arrayBuffer());
}

/** Vérifie qu'un fichier choisi est bien une vidéo acceptée (contenu réel, pas l'extension). */
export async function checkVideoFile(file: Blob): Promise<PreparedVideo["mimeType"]> {
  const mime = mimeFromContainer(await readHead(file));
  if (!mime) throw new VideoProcessingError("Ce fichier n'est pas une vidéo prise en charge (MP4, MOV ou WebM).");
  return mime;
}

export async function prepareVideo(file: Blob, onProgress?: (ratio: number) => void): Promise<PreparedVideo> {
  const originalMime = await checkVideoFile(file);
  const original: OriginalInfo = { size: file.size, mimeType: file.type || originalMime };
  const fallback = (): PreparedVideo => {
    if (file.size > MAX_VIDEO_BYTES) {
      throw new VideoProcessingError("Cette vidéo est trop lourde (50 Mo maximum) et votre appareil ne permet pas de la compresser. Filmez une séquence plus courte.");
    }
    return { blob: file, mimeType: originalMime, processing: "original", original, width: original.width, height: original.height, duration: original.duration };
  };

  let input: Input | null = null;
  try {
    input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
    const track = await input.getPrimaryVideoTrack();
    if (!track) throw new VideoProcessingError("Aucune image vidéo n'a été trouvée dans ce fichier.");
    const [w, h, duration] = [await track.getDisplayWidth(), await track.getDisplayHeight(), await input.computeDuration()];
    Object.assign(original, { width: w, height: h, duration });
    if (typeof VideoEncoder === "undefined") return fallback();

    const target = targetDimensions(w, h);
    const codec = await getFirstEncodableVideoCodec(["avc", "vp9", "vp8"], { width: target.width, height: target.height, bitrate: TARGET_BITRATE });
    if (!codec || !(await track.canDecode())) return fallback();

    const isMp4 = codec === "avc";
    const output = new Output({
      format: isMp4 ? new Mp4OutputFormat({ fastStart: "in-memory" }) : new WebMOutputFormat(),
      target: new BufferTarget(),
    });
    const conversion = await Conversion.init({
      input,
      output,
      video: (t) => ({
        ...(t.displayWidth >= t.displayHeight ? { height: target.height } : { width: target.width }),
        codec,
        bitrate: TARGET_BITRATE,
        frameRate: MAX_FRAME_RATE,
        forceTranscode: true,
      }),
      audio: { discard: true },
      showWarnings: false,
    });
    if (!conversion.isValid) return fallback();
    conversion.onProgress = (p) => onProgress?.(Math.min(1, Math.max(0, p)));
    await conversion.execute();
    const buffer = (output.target as BufferTarget).buffer;
    if (!buffer) return fallback();
    const mimeType = isMp4 ? "video/mp4" : "video/webm";
    const blob = new Blob([buffer], { type: mimeType });
    // Si, exceptionnellement, la compression n'apporte rien, on garde l'original.
    if (blob.size >= file.size && file.size <= MAX_VIDEO_BYTES) return fallback();
    if (blob.size > MAX_VIDEO_BYTES) {
      throw new VideoProcessingError("Même compressée, cette vidéo dépasse 50 Mo. Filmez la pièce en moins de 2 minutes.");
    }
    return {
      blob, mimeType, processing: "compressed", encoder: `mediabunny-${codec}`,
      width: target.width, height: target.height, duration, original,
    };
  } catch (error) {
    if (error instanceof VideoProcessingError) throw error;
    console.warn("[vidéo] compression impossible, envoi de l'original", error);
    return fallback();
  } finally {
    input?.dispose?.();
  }
}

export type ExtractedFrame = { blob: Blob; time: number; width: number; height: number };

const SIG_W = 32;
const SIG_H = 18;
const SHARP_W = 160;

function analyse(source: CanvasImageSource, width: number, height: number): Omit<FrameCandidate, "time"> {
  const sharpH = Math.max(3, Math.round((SHARP_W * height) / width));
  const canvas = document.createElement("canvas");
  canvas.width = SHARP_W;
  canvas.height = sharpH;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(source, 0, 0, SHARP_W, sharpH);
  const rgba = ctx.getImageData(0, 0, SHARP_W, sharpH).data;
  const gray = new Uint8ClampedArray(SHARP_W * sharpH);
  let total = 0;
  for (let i = 0; i < gray.length; i++) {
    const v = 0.299 * rgba[i * 4] + 0.587 * rgba[i * 4 + 1] + 0.114 * rgba[i * 4 + 2];
    gray[i] = v;
    total += v;
  }
  ctx.drawImage(source, 0, 0, SIG_W, SIG_H);
  const small = ctx.getImageData(0, 0, SIG_W, SIG_H).data;
  const signature = new Uint8Array(SIG_W * SIG_H);
  for (let i = 0; i < signature.length; i++) signature[i] = 0.299 * small[i * 4] + 0.587 * small[i * 4 + 1] + 0.114 * small[i * 4 + 2];
  return { sharpness: laplacianVariance(gray, SHARP_W, sharpH), signature, brightness: total / gray.length };
}

async function toJpeg(source: CanvasImageSource, width: number, height: number): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d")!.drawImage(source, 0, 0, width, height);
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("JPEG"))), "image/jpeg", 0.82));
}

/**
 * Extraction d'images représentatives (jusqu'à 8) : échantillonnage régulier,
 * puis tri par netteté et élimination des images quasi identiques.
 * Images JPEG de 1280 px de large au plus.
 */
export async function extractFrames(video: Blob, max = 8, onProgress?: (ratio: number) => void): Promise<ExtractedFrame[]> {
  try {
    return await extractWithMediabunny(video, max, onProgress);
  } catch (error) {
    console.warn("[vidéo] extraction par décodeur impossible, lecture par le lecteur vidéo", error);
    return extractWithVideoElement(video, max, onProgress);
  }
}

async function extractWithMediabunny(video: Blob, max: number, onProgress?: (ratio: number) => void) {
  const input = new Input({ source: new BlobSource(video), formats: ALL_FORMATS });
  try {
    const track = await input.getPrimaryVideoTrack();
    if (!track || !(await track.canDecode())) throw new Error("Décodage impossible");
    const duration = await input.computeDuration();
    const w = await track.getDisplayWidth();
    const h = await track.getDisplayHeight();
    const outW = Math.min(1280, w - (w % 2));
    const outH = Math.round((outW * h) / w);
    const sink = new CanvasSink(track, { width: outW, height: outH, poolSize: 0 });
    const times = sampleTimestamps(duration, 24);
    const candidates: Array<FrameCandidate & { canvas: CanvasImageSource }> = [];
    let i = 0;
    for await (const wrapped of sink.canvasesAtTimestamps(times)) {
      i++;
      onProgress?.(i / times.length);
      if (!wrapped) continue;
      const copy = document.createElement("canvas");
      copy.width = outW;
      copy.height = outH;
      copy.getContext("2d")!.drawImage(wrapped.canvas, 0, 0);
      candidates.push({ ...analyse(copy, outW, outH), time: wrapped.timestamp, canvas: copy });
    }
    if (candidates.length === 0) throw new Error("Aucune image décodée");
    const chosen = selectFrames(candidates, { max }) as Array<FrameCandidate & { canvas: CanvasImageSource }>;
    return Promise.all(chosen.map(async (c) => ({ blob: await toJpeg(c.canvas, outW, outH), time: c.time, width: outW, height: outH })));
  } finally {
    input.dispose?.();
  }
}

async function extractWithVideoElement(video: Blob, max: number, onProgress?: (ratio: number) => void): Promise<ExtractedFrame[]> {
  const url = URL.createObjectURL(video);
  const el = document.createElement("video");
  el.muted = true;
  el.playsInline = true;
  el.preload = "auto";
  el.src = url;
  try {
    await new Promise<void>((resolve, reject) => {
      el.onloadeddata = () => resolve();
      el.onerror = () => reject(new VideoProcessingError("Impossible de lire cette vidéo pour en extraire des images."));
    });
    let duration = el.duration;
    if (!Number.isFinite(duration)) {
      // Vidéos enregistrées sans durée (certains navigateurs) : on force le calcul.
      el.currentTime = 1e7;
      await new Promise((r) => (el.ondurationchange = r));
      duration = el.duration;
    }
    const outW = Math.min(1280, el.videoWidth - (el.videoWidth % 2));
    const outH = Math.round((outW * el.videoHeight) / el.videoWidth);
    const times = sampleTimestamps(duration, 16);
    const candidates: Array<FrameCandidate & { canvas: HTMLCanvasElement }> = [];
    for (const [i, t] of times.entries()) {
      el.currentTime = t;
      await new Promise((r) => (el.onseeked = r));
      const canvas = document.createElement("canvas");
      canvas.width = outW;
      canvas.height = outH;
      canvas.getContext("2d")!.drawImage(el, 0, 0, outW, outH);
      candidates.push({ ...analyse(canvas, outW, outH), time: t, canvas });
      onProgress?.((i + 1) / times.length);
    }
    const chosen = selectFrames(candidates, { max }) as Array<FrameCandidate & { canvas: HTMLCanvasElement }>;
    return Promise.all(chosen.map(async (c) => ({ blob: await toJpeg(c.canvas, outW, outH), time: c.time, width: outW, height: outH })));
  } finally {
    URL.revokeObjectURL(url);
  }
}
