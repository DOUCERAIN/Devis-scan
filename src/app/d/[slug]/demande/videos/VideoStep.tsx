"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Camera, CheckCircle2, Film, ImageIcon, RotateCcw, Trash2, Upload } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { cn } from "@/components/ui/cn";
import { CameraRecorder, CAMERA_ERRORS, type CameraError } from "@/components/customer/CameraRecorder";
import { checkVideoFile, extractFrames, prepareVideo, VideoProcessingError, type ExtractedFrame, type PreparedVideo } from "@/lib/video/compress";
import { uploadResumable, uploadSmall, UploadError, type ResumableState } from "@/lib/video/upload";
import { formatBytes } from "@/lib/video/signature";
import { stepHref } from "@/lib/public-request/steps";
import type { DraftRoom, DraftVideo } from "@/lib/public-request/service";
import {
  confirmFramesAction, confirmVideoAction, discardVideoAction, prepareFramesAction, prepareVideoAction, videoPreviewAction,
} from "../../video-actions";

type Source = "camera" | "native_camera" | "gallery";
type Phase = "idle" | "review" | "compressing" | "extracting" | "uploading" | "frames" | "done" | "error";

type Job = {
  file: Blob;
  source: Source;
  previewUrl: string;
  prepared?: PreparedVideo;
  frames?: ExtractedFrame[];
  videoId?: string;
  path?: string;
  uploadToken?: string;
  resumable: ResumableState;
  uploaded?: boolean;
};

type UploadConfig = { supabaseUrl: string; publishableKey: string };

const PHASE_LABEL: Partial<Record<Phase, string>> = {
  compressing: "Compression de la vidéo…",
  extracting: "Sélection des images…",
  uploading: "Envoi sécurisé de la vidéo…",
  frames: "Envoi des images…",
};

function RoomCard({ slug, room, config, open, onOpen, onDone }: {
  slug: string; room: DraftRoom; config: UploadConfig; open: boolean; onOpen: () => void; onDone: () => void;
}) {
  const router = useRouter();
  const existing: DraftVideo | undefined = room.videos[0];
  const [phase, setPhase] = useState<Phase>(existing ? "done" : "idle");
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [camera, setCamera] = useState(false);
  const [cameraError, setCameraError] = useState<CameraError | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [thumbs, setThumbs] = useState<string[]>([]);
  const [summary, setSummary] = useState<{ size: number; original?: number; frames: number; processing?: string } | null>(
    existing ? { size: existing.size_bytes ?? 0, original: existing.original_size_bytes ?? undefined, frames: existing.frames, processing: existing.processing ?? undefined } : null,
  );
  const job = useRef<Job | null>(null);
  // Copie des informations du traitement utiles à l'affichage.
  const [view, setView] = useState<{ previewUrl: string; videoId?: string; size?: number } | null>(null);
  const sync = useCallback(() => {
    const j = job.current;
    setView(j ? { previewUrl: j.previewUrl, videoId: j.videoId, size: j.prepared?.blob.size } : null);
  }, []);
  const nativeInput = useRef<HTMLInputElement>(null);
  const galleryInput = useRef<HTMLInputElement>(null);
  const busy = phase === "compressing" || phase === "extracting" || phase === "uploading" || phase === "frames";

  // Avertit avant de quitter la page pendant un traitement.
  useEffect(() => {
    if (!busy) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [busy]);

  useEffect(() => () => { if (job.current) URL.revokeObjectURL(job.current.previewUrl); thumbs.forEach(URL.revokeObjectURL); }, [thumbs]);

  async function accept(file: Blob, source: Source) {
    setMessage(null);
    try {
      await checkVideoFile(file);
    } catch (error) {
      setPhase(view ? "review" : "idle");
      setMessage(error instanceof VideoProcessingError ? error.message : "Ce fichier n'est pas une vidéo prise en charge.");
      return;
    }
    if (job.current) URL.revokeObjectURL(job.current.previewUrl);
    job.current = { file, source, previewUrl: URL.createObjectURL(file), resumable: {} };
    sync();
    setCamera(false);
    setCameraError(null);
    setPhase("review");
  }

  const onCameraError = useCallback((kind: CameraError) => {
    setCamera(false);
    setCameraError(kind);
  }, []);

  async function run() {
    const j = job.current;
    if (!j) return;
    setMessage(null);
    try {
      if (!j.prepared) {
        setPhase("compressing");
        setProgress(0);
        j.prepared = await prepareVideo(j.file, setProgress);
        sync();
      }
      if (!j.frames) {
        setPhase("extracting");
        setProgress(0);
        j.frames = await extractFrames(j.prepared.blob, 8, setProgress).catch(() => []);
      }
      const p = j.prepared;
      if (!j.videoId) {
        const res = await prepareVideoAction(slug, {
          roomId: room.id, mimeType: p.mimeType, size: p.blob.size,
          meta: {
            capture_source: j.source, processing: p.processing, encoder: p.encoder,
            original_size_bytes: p.original.size, original_mime_type: p.original.mimeType,
            original_width: p.original.width ? Math.round(p.original.width) : undefined,
            original_height: p.original.height ? Math.round(p.original.height) : undefined,
            original_duration_seconds: p.original.duration && Number.isFinite(p.original.duration) ? p.original.duration : undefined,
          },
        });
        if (!res.ok) throw new Error(res.error);
        Object.assign(j, res.data);
        j.resumable = {};
        sync();
      }
      if (!j.uploaded) {
        setPhase("uploading");
        await uploadResumable(
          { ...config, bucket: "request-media", path: j.path!, token: j.uploadToken! },
          p.blob, p.mimeType, j.resumable, (sent, total) => setProgress(sent / total),
        );
        const conf = await confirmVideoAction(slug, {
          videoId: j.videoId!, duration: p.duration && Number.isFinite(p.duration) ? p.duration : undefined, width: p.width, height: p.height,
        });
        if (!conf.ok) {
          // Fichier refusé à la vérification : on repart de zéro pour un nouvel envoi.
          j.videoId = undefined;
          sync();
          throw new Error(conf.error);
        }
        j.uploaded = true;
      }
      let framesSent = 0;
      if (j.frames.length > 0) {
        setPhase("frames");
        setProgress(0);
        const slots = await prepareFramesAction(slug, j.videoId!, j.frames.length);
        if (!slots.ok) throw new Error(slots.error);
        const sent: Array<{ path: string; capturedAtMs: number; width: number; height: number }> = [];
        for (const [i, slot] of slots.data.entries()) {
          const f = j.frames[i];
          await uploadSmall({ ...config, bucket: "request-media", path: slot.path, token: slot.uploadToken }, f.blob, "image/jpeg");
          sent.push({ path: slot.path, capturedAtMs: f.time * 1000, width: f.width, height: f.height });
          setProgress((i + 1) / slots.data.length);
        }
        const saved = await confirmFramesAction(slug, j.videoId!, sent);
        if (!saved.ok) throw new Error(saved.error);
        framesSent = saved.data.count;
      }
      setThumbs(j.frames.map((f) => URL.createObjectURL(f.blob)));
      setPreview(j.previewUrl);
      setSummary({ size: p.blob.size, original: p.original.size, frames: framesSent, processing: p.processing });
      setPhase("done");
      router.refresh();
      onDone();
    } catch (error) {
      const text = error instanceof VideoProcessingError || error instanceof UploadError || error instanceof Error
        ? error.message
        : "Un problème est survenu.";
      setMessage(text);
      setPhase("error");
    }
  }

  async function remove() {
    const videoId = job.current?.videoId ?? existing?.id;
    if (videoId && !window.confirm("Supprimer cette vidéo ?")) return;
    if (videoId) {
      const res = await discardVideoAction(slug, videoId);
      if (!res.ok) { setMessage(res.error); return; }
    }
    job.current = null;
    sync();
    setThumbs([]);
    setPreview(null);
    setSummary(null);
    setPhase("idle");
    router.refresh();
  }

  async function showExisting() {
    if (!existing) return;
    const res = await videoPreviewAction(slug, existing.id);
    if (res.ok) setPreview(res.data.url);
    else setMessage(res.error);
  }

  const status = phase === "done" ? "Vidéo envoyée" : busy ? "Envoi en cours" : phase === "error" ? "À reprendre" : "Pas encore de vidéo";

  return (
    <li className={cn("rounded-lg border bg-surface", open ? "border-brand-soft-strong shadow-sm" : "border-border")}>
      <button type="button" onClick={onOpen} aria-expanded={open} className="flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left">
        {phase === "done" ? (
          <CheckCircle2 aria-hidden className="size-6 shrink-0 text-success" />
        ) : (
          <Film aria-hidden className="size-6 shrink-0 text-ink-muted" />
        )}
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">{room.name}</span>
          <span className={cn("block text-sm", phase === "done" ? "text-success-text" : phase === "error" ? "text-warning-text" : "text-ink-muted")}>{status}</span>
        </span>
      </button>

      {open && (
        <div className="flex flex-col gap-4 border-t border-border px-4 py-4">
          {room.description && <p className="text-sm text-ink-secondary">{room.description}</p>}

          {cameraError && (
            <Alert tone="warning" title={CAMERA_ERRORS[cameraError].title}>{CAMERA_ERRORS[cameraError].text}</Alert>
          )}
          {message && <Alert tone="danger" title={message} />}

          {(phase === "idle" || (phase === "error" && !view)) && (
            <>
              <ul className="grid gap-1.5 rounded-md bg-canvas px-4 py-3 text-sm text-ink-secondary">
                <li>• Montrez toute la pièce, en tournant lentement.</li>
                <li>• Filmez les meubles sous plusieurs angles, ouvrez les rangements.</li>
                <li>• Entre 30 secondes et 2 minutes suffisent.</li>
              </ul>
              <div className="flex flex-col gap-2">
                {cameraError !== "unsupported" && cameraError !== "unavailable" && (
                  <Button size="lg" block onClick={() => { setCameraError(null); setCamera(true); }}>
                    <Camera aria-hidden />Filmer cette pièce
                  </Button>
                )}
                {cameraError && (
                  <Button size="lg" block variant={cameraError === "unsupported" || cameraError === "unavailable" ? "primary" : "secondary"}
                    onClick={() => nativeInput.current?.click()}>
                    <Camera aria-hidden />Utiliser l&apos;appareil photo du téléphone
                  </Button>
                )}
                <Button size="lg" block variant="secondary" onClick={() => galleryInput.current?.click()}>
                  <Upload aria-hidden />Choisir une vidéo existante
                </Button>
              </div>
            </>
          )}

          {(phase === "review" || (phase === "error" && view && !view.videoId)) && view && (
            <div className="flex flex-col gap-3">
              <video src={view.previewUrl} controls playsInline preload="metadata" className="aspect-video w-full rounded-lg bg-media" />
              <p className="text-sm text-ink-secondary">Vérifiez la vidéo : la pièce est-elle entièrement visible ?</p>
              <Button size="lg" block onClick={run}>Utiliser cette vidéo</Button>
              <Button size="lg" block variant="secondary" onClick={() => { job.current = null; sync(); setPhase("idle"); setMessage(null); }}>
                <RotateCcw aria-hidden />Refaire
              </Button>
            </div>
          )}

          {busy && (
            <div className="flex flex-col gap-2" role="status" aria-live="polite">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">{PHASE_LABEL[phase]}</span>
                <span className="tabular-nums text-ink-secondary">{Math.round(progress * 100)} %</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-surface-subtle">
                <div className="h-full rounded-full bg-brand transition-[width]" style={{ width: `${Math.round(progress * 100)}%` }} />
              </div>
              {phase === "uploading" && view?.size && (
                <p className="text-xs text-ink-muted tabular-nums">
                  {formatBytes(progress * view.size)} sur {formatBytes(view.size)} · ne fermez pas cette page
                </p>
              )}
            </div>
          )}

          {phase === "error" && view?.videoId && (
            <Button size="lg" block onClick={run}><RotateCcw aria-hidden />Reprendre l&apos;envoi</Button>
          )}

          {phase === "done" && summary && (
            <div className="flex flex-col gap-3">
              {preview ? (
                <video src={preview} controls playsInline preload="metadata" className="aspect-video w-full rounded-lg bg-media" />
              ) : (
                <Button variant="secondary" onClick={showExisting}><Film aria-hidden />Revoir la vidéo</Button>
              )}
              <p className="text-sm text-ink-secondary">
                {formatBytes(summary.size)}
                {summary.processing === "compressed" && summary.original ? ` (compressée, ${formatBytes(summary.original)} à l'origine)` : ""}
                {` · ${summary.frames} image${summary.frames > 1 ? "s" : ""} extraite${summary.frames > 1 ? "s" : ""}`}
              </p>
              {thumbs.length > 0 && (
                <div className="grid grid-cols-4 gap-1.5">
                  {thumbs.map((src, i) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={i} src={src} alt={`Image ${i + 1} extraite de la vidéo`} className="aspect-video w-full rounded-sm object-cover" />
                  ))}
                </div>
              )}
              {summary.frames === 0 && (
                <p className="flex items-center gap-1.5 text-xs text-ink-muted"><ImageIcon aria-hidden className="size-3.5" />Aucune image n&apos;a pu être extraite sur cet appareil ; la vidéo reste utilisable.</p>
              )}
              <div className="grid grid-cols-2 gap-2">
                <Button variant="secondary" onClick={() => remove().then(() => setCamera(false))}><RotateCcw aria-hidden />Refaire</Button>
                <Button variant="danger" onClick={remove}><Trash2 aria-hidden />Supprimer</Button>
              </div>
            </div>
          )}

          <input ref={nativeInput} type="file" accept="video/*" capture="environment" className="sr-only" tabIndex={-1}
            aria-label="Filmer avec l'appareil photo du téléphone"
            onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) accept(f, "native_camera"); }} />
          <input ref={galleryInput} type="file" accept="video/mp4,video/quicktime,video/webm,video/*" className="sr-only" tabIndex={-1}
            aria-label="Choisir une vidéo existante"
            onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) accept(f, "gallery"); }} />
        </div>
      )}

      {camera && (
        <CameraRecorder roomName={room.name} onCapture={(blob) => accept(blob, "camera")} onClose={() => setCamera(false)} onError={onCameraError} />
      )}
    </li>
  );
}

export function VideoStep({ slug, rooms, config }: { slug: string; rooms: DraftRoom[]; config: UploadConfig }) {
  const [open, setOpen] = useState<string | null>(rooms.find((r) => r.videos.length === 0)?.id ?? rooms[0]?.id ?? null);
  const [doneIds, setDoneIds] = useState<Set<string>>(new Set(rooms.filter((r) => r.videos.length > 0).map((r) => r.id)));
  const filmed = rooms.filter((r) => doneIds.has(r.id)).length;

  function next(from: string) {
    const ids = rooms.map((r) => r.id);
    const after = ids.slice(ids.indexOf(from) + 1).concat(ids.slice(0, ids.indexOf(from)));
    setOpen(after.find((id) => !doneIds.has(id) && id !== from) ?? null);
  }

  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm font-medium text-ink-secondary" aria-live="polite">
        {filmed} pièce{filmed > 1 ? "s" : ""} filmée{filmed > 1 ? "s" : ""} sur {rooms.length}
      </p>
      <ul className="flex flex-col gap-3">
        {rooms.map((room) => (
          <RoomCard
            key={room.id}
            slug={slug}
            room={room}
            config={config}
            open={open === room.id}
            onOpen={() => setOpen(open === room.id ? null : room.id)}
            onDone={() => setDoneIds((s) => new Set(s).add(room.id))}
          />
        ))}
      </ul>
      {open && doneIds.has(open) && rooms.some((r) => !doneIds.has(r.id)) && (
        <Button size="lg" variant="secondary" onClick={() => next(open)}>Pièce suivante</Button>
      )}
      <ButtonLink href={stepHref(slug, "recapitulatif")} size="lg" block variant={filmed === rooms.length ? "primary" : "secondary"}>
        {filmed === rooms.length ? "Continuer vers le récapitulatif" : "Passer au récapitulatif"}
      </ButtonLink>
      <p className="text-center text-sm text-ink-muted">
        Une pièce à ajouter ? <Link href={stepHref(slug, "pieces")} className="font-medium text-brand underline">Modifier la liste des pièces</Link>
      </p>
    </div>
  );
}
