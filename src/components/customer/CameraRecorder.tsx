"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, X } from "lucide-react";
import { Button } from "@/components/ui/Button";

export const MAX_RECORDING_SECONDS = 120;

const TIPS = [
  "Montrez l'ensemble de la pièce, d'un mur à l'autre.",
  "Avancez et tournez lentement.",
  "Filmez les gros meubles sous plusieurs angles.",
  "Évitez les mouvements trop rapides.",
  "Montrez les objets volumineux et fragiles.",
  "N'oubliez pas les placards et rangements : ouvrez-les.",
];

/** Format d'enregistrement le plus adapté au navigateur (MP4 sur Safari, MP4 ou WebM sur Chrome). */
export function pickRecorderMime(isSupported: (type: string) => boolean): string | undefined {
  const candidates = ["video/mp4;codecs=avc1", "video/mp4", "video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"];
  return candidates.find((type) => {
    try {
      return isSupported(type);
    } catch {
      return false;
    }
  });
}

export type CameraError = "denied" | "unavailable" | "busy" | "unsupported" | "interrupted";

export const CAMERA_ERRORS: Record<CameraError, { title: string; text: string }> = {
  denied: {
    title: "Accès à la caméra refusé",
    text: "Autorisez la caméra dans les réglages de votre navigateur (icône à côté de l'adresse du site), puis réessayez. Vous pouvez aussi utiliser l'appareil photo de votre téléphone ou choisir une vidéo existante.",
  },
  unavailable: { title: "Aucune caméra disponible", text: "Utilisez l'appareil photo de votre téléphone ou choisissez une vidéo existante." },
  busy: { title: "Caméra occupée", text: "Fermez les autres applications qui utilisent la caméra, puis réessayez." },
  unsupported: { title: "Tournage impossible dans ce navigateur", text: "Utilisez l'appareil photo de votre téléphone ou choisissez une vidéo existante." },
  interrupted: { title: "Le tournage a été interrompu", text: "La caméra s'est arrêtée (appel, changement d'application…). Recommencez le tournage." },
};

function classify(error: unknown): CameraError {
  const name = (error as { name?: string })?.name ?? "";
  if (name === "NotAllowedError" || name === "SecurityError" || name === "PermissionDeniedError") return "denied";
  if (name === "NotFoundError" || name === "OverconstrainedError" || name === "DevicesNotFoundError") return "unavailable";
  if (name === "NotReadableError" || name === "TrackStartError" || name === "AbortError") return "busy";
  return "unsupported";
}

function clock(s: number) {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/**
 * Caméra intégrée à la page (getUserMedia + MediaRecorder), avec consignes
 * pendant le tournage. Sans le son. En cas d'échec, `onError` permet au parent
 * de proposer l'appareil photo du téléphone ou la galerie.
 */
export function CameraRecorder({ roomName, onCapture, onClose, onError }: {
  roomName: string;
  onCapture: (file: Blob) => void;
  onClose: () => void;
  onError: (kind: CameraError) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const [state, setState] = useState<"starting" | "ready" | "recording">("starting");
  const [elapsed, setElapsed] = useState(0);
  const [tip, setTip] = useState(0);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") return onError("unsupported");
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30, max: 30 } },
          audio: false,
        });
        if (cancelled) return stream.getTracks().forEach((t) => t.stop());
        streamRef.current = stream;
        stream.getVideoTracks()[0]?.addEventListener("ended", () => {
          if (recorderRef.current?.state === "recording") onError("interrupted");
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => undefined);
        }
        setState("ready");
      } catch (error) {
        if (!cancelled) onError(classify(error));
      }
    })();
    return () => {
      cancelled = true;
      if (recorderRef.current?.state === "recording") recorderRef.current.stop();
      stopStream();
    };
  }, [onError, stopStream]);

  useEffect(() => {
    if (state !== "recording") return;
    const timer = setInterval(() => setElapsed((e) => e + 1), 1000);
    const tips = setInterval(() => setTip((t) => (t + 1) % TIPS.length), 4000);
    return () => { clearInterval(timer); clearInterval(tips); };
  }, [state]);

  const stop = useCallback(() => {
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
  }, []);

  useEffect(() => {
    if (state === "recording" && elapsed >= MAX_RECORDING_SECONDS) stop();
  }, [elapsed, state, stop]);

  function start() {
    const stream = streamRef.current;
    if (!stream) return;
    const mimeType = pickRecorderMime((t) => MediaRecorder.isTypeSupported(t));
    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(stream, { ...(mimeType ? { mimeType } : {}), videoBitsPerSecond: 2_500_000 });
    } catch {
      return onError("unsupported");
    }
    chunks.current = [];
    recorder.ondataavailable = (e) => e.data.size > 0 && chunks.current.push(e.data);
    recorder.onstop = () => {
      const type = recorder.mimeType || mimeType || "video/webm";
      const blob = new Blob(chunks.current, { type: type.split(";")[0] });
      stopStream();
      if (blob.size > 0) onCapture(blob);
      else onError("interrupted");
    };
    recorder.start(1000);
    recorderRef.current = recorder;
    setElapsed(0);
    setState("recording");
  }

  return (
    <div role="dialog" aria-modal="true" aria-label={`Filmer : ${roomName}`} className="fixed inset-0 z-50 flex flex-col bg-media text-white">
      <div className="flex items-center justify-between gap-3 px-4 pt-[max(12px,env(safe-area-inset-top))] pb-3">
        <p className="truncate text-sm font-semibold">{roomName}</p>
        <button type="button" onClick={() => { stop(); stopStream(); onClose(); }} className="inline-grid size-11 place-items-center rounded-full bg-white/10">
          <X aria-hidden className="size-5" /><span className="sr-only">Fermer la caméra</span>
        </button>
      </div>
      <div className="relative min-h-0 flex-1">
        <video ref={videoRef} playsInline muted autoPlay className="absolute inset-0 size-full object-cover" />
        {state === "starting" && <p className="absolute inset-0 grid place-items-center text-sm">Ouverture de la caméra…</p>}
        <div className="absolute inset-x-4 top-4 flex justify-center">
          {state === "recording" ? (
            <span className="flex items-center gap-2 rounded-full bg-black/55 px-3 py-1 text-sm font-semibold tabular-nums">
              <span className="size-2.5 animate-pulse rounded-full bg-danger" />{clock(elapsed)} / {clock(MAX_RECORDING_SECONDS)}
            </span>
          ) : null}
        </div>
        <p aria-live="polite" className="absolute inset-x-4 bottom-4 rounded-md bg-black/55 px-3 py-2 text-center text-sm leading-5">
          {state === "recording" ? TIPS[tip] : "Tenez le téléphone à hauteur de poitrine, puis appuyez sur le bouton pour commencer."}
        </p>
      </div>
      <div className="flex flex-col items-center gap-2 px-4 pt-4 pb-[max(16px,env(safe-area-inset-bottom))]">
        {state === "recording" ? (
          <Button onClick={stop} size="lg" variant="danger" className="w-full max-w-sm">Terminer le tournage</Button>
        ) : (
          <Button onClick={start} size="lg" disabled={state !== "ready"} className="w-full max-w-sm">
            <Camera aria-hidden />Commencer à filmer
          </Button>
        )}
        <p className="text-xs text-white/70">Le son n&apos;est pas enregistré. 2 minutes maximum.</p>
      </div>
    </div>
  );
}
