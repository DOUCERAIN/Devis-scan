/**
 * Reconnaissance du format réel d'un fichier vidéo à partir de ses premiers octets
 * (on ne se fie pas à l'extension ni au type annoncé par le navigateur).
 */
export type VideoContainer = "mp4" | "quicktime" | "webm";

export function detectVideoContainer(head: Uint8Array): VideoContainer | null {
  if (head.length >= 12) {
    const box = String.fromCharCode(head[4], head[5], head[6], head[7]);
    if (box === "ftyp") {
      const brand = String.fromCharCode(head[8], head[9], head[10], head[11]);
      return brand === "qt  " ? "quicktime" : "mp4";
    }
    if (["moov", "mdat", "wide", "free", "skip"].includes(box)) return "quicktime";
  }
  if (head.length >= 4 && head[0] === 0x1a && head[1] === 0x45 && head[2] === 0xdf && head[3] === 0xa3) return "webm";
  return null;
}

/** Le type déclaré est-il cohérent avec le contenu ? (MP4 et MOV partagent la même structure) */
export function containerMatchesMime(container: VideoContainer | null, mime: string): boolean {
  if (!container) return false;
  if (mime === "video/webm") return container === "webm";
  if (mime === "video/mp4" || mime === "video/quicktime") return container === "mp4" || container === "quicktime";
  return false;
}

export const ACCEPTED_VIDEO_MIME = ["video/mp4", "video/webm", "video/quicktime"] as const;
export const MAX_VIDEO_BYTES = 50 * 1024 * 1024;

export function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} Ko`;
  return `${(bytes / (1024 * 1024)).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} Mo`;
}
