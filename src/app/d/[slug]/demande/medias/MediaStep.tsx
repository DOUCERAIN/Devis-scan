"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, CheckCircle2, Film, ImageIcon, ImagePlus, Loader2, RotateCcw, Trash2, Upload, Video } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { cn } from "@/components/ui/cn";
import { CameraRecorder, CAMERA_ERRORS, type CameraError } from "@/components/customer/CameraRecorder";
import { checkVideoFile, extractFrames, prepareVideo, VideoProcessingError } from "@/lib/video/compress";
import { preparePhoto, PhotoProcessingError } from "@/lib/video/photo";
import { uploadResumable, uploadSmall, UploadError, type ResumableState } from "@/lib/video/upload";
import { formatBytes } from "@/lib/video/signature";
import { stepHref } from "@/lib/public-request/steps";
import type { DraftVideo } from "@/lib/public-request/service";
import {
  confirmFramesAction, confirmPhotoAction, confirmVideoAction, discardVideoAction, prepareFramesAction, preparePhotoAction, prepareVideoAction, videoPreviewAction,
} from "../../video-actions";

type UploadConfig = { supabaseUrl: string; publishableKey: string };
type Source = "camera" | "native_camera" | "gallery";
type Kind = "video" | "photo";

/** Média choisi par le client, de la sélection à l'envoi. */
type Item = {
  key: string;
  kind: Kind;
  source: Source;
  file: Blob;
  name: string;
  previewUrl: string;
  status: "selected" | "processing" | "uploaded" | "error";
  step?: string;
  progress?: number;
  error?: string;
  /** Envoi d'une vidéo : reprise possible après une coupure. */
  serverId?: string;
  path?: string;
  uploadToken?: string;
  resumable: ResumableState;
  uploaded?: boolean;
};

const TIPS = [
  "Filmez lentement.",
  "Montrez l'ensemble des meubles.",
  "Faites un tour complet de chaque pièce.",
  "Évitez les mouvements trop rapides.",
  "Veillez à ce que les objets soient bien visibles (lumière allumée, portes de placard ouvertes).",
];

let counter = 0;
const newKey = () => `m${Date.now().toString(36)}${(counter++).toString(36)}`;

/**
 * Médias du logement (parcours v3) : filmer, importer une ou plusieurs vidéos, importer des photos, sans
 * déclarer de pièce. Le client voit sa sélection, retire ce qu'il veut, puis valide : chaque vidéo est
 * compressée (720p, sans son) et ses images extraites dans le navigateur, puis envoyée (TUS reprenable) ;
 * chaque photo est réduite et convertie en JPEG. L'analyse traite ensuite l'ensemble comme un tout.
 */
export function MediaStep({ slug, existing, config }: { slug: string; existing: DraftVideo[]; config: UploadConfig }) {
  const router = useRouter();
  const [items, setItems] = useState<Item[]>([]);
  const [sent, setSent] = useState<DraftVideo[]>(existing);
  const [mode, setMode] = useState<"choose" | "film">("choose");
  const [camera, setCamera] = useState(false);
  const [cameraError, setCameraError] = useState<CameraError | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const videoInput = useRef<HTMLInputElement>(null);
  const photoInput = useRef<HTMLInputElement>(null);
  const nativeInput = useRef<HTMLInputElement>(null);
  const itemsRef = useRef<Item[]>([]);
  useEffect(() => { itemsRef.current = items; }, [items]);
  useEffect(() => () => itemsRef.current.forEach((i) => URL.revokeObjectURL(i.previewUrl)), []);
  useEffect(() => {
    if (!running) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [running]);

  const patch = useCallback((key: string, change: Partial<Item>) => {
    setItems((list) => list.map((i) => (i.key === key ? { ...i, ...change } : i)));
  }, []);

  async function addFiles(files: FileList | Blob[], kind: Kind, source: Source) {
    setMessage(null);
    const added: Item[] = [];
    const refused: string[] = [];
    for (const file of Array.from(files)) {
      const name = "name" in file && typeof file.name === "string" ? file.name : kind === "video" ? "Séquence filmée" : "Photo";
      if (kind === "video") {
        try {
          await checkVideoFile(file);
        } catch {
          refused.push(name);
          continue;
        }
      } else if (!(file.type.startsWith("image/") || /\.(heic|heif|jpe?g|png|webp)$/i.test(name))) {
        refused.push(name);
        continue;
      }
      added.push({ key: newKey(), kind, source, file, name, previewUrl: URL.createObjectURL(file), status: "selected", resumable: {} });
    }
    if (refused.length) setMessage(`${refused.length === 1 ? "Ce fichier n'est pas pris en charge" : "Ces fichiers ne sont pas pris en charge"} : ${refused.join(", ")}.`);
    if (added.length) setItems((list) => [...list, ...added]);
  }

  function removeSelected(key: string) {
    const item = itemsRef.current.find((i) => i.key === key);
    if (item) URL.revokeObjectURL(item.previewUrl);
    setItems((list) => list.filter((i) => i.key !== key));
  }

  async function processVideo(item: Item) {
    patch(item.key, { status: "processing", step: "Compression…", progress: 0, error: undefined });
    const prepared = await prepareVideo(item.file, (p) => patch(item.key, { progress: p }));
    patch(item.key, { step: "Sélection des images…", progress: 0 });
    const frames = await extractFrames(prepared.blob, 8, (p) => patch(item.key, { progress: p })).catch(() => []);
    let { serverId, path, uploadToken } = item;
    if (!serverId) {
      const res = await prepareVideoAction(slug, {
        mimeType: prepared.mimeType, size: prepared.blob.size,
        meta: {
          capture_source: item.source, processing: prepared.processing, encoder: prepared.encoder,
          original_size_bytes: prepared.original.size, original_mime_type: prepared.original.mimeType,
          original_width: prepared.original.width ? Math.round(prepared.original.width) : undefined,
          original_height: prepared.original.height ? Math.round(prepared.original.height) : undefined,
          original_duration_seconds: prepared.original.duration && Number.isFinite(prepared.original.duration) ? prepared.original.duration : undefined,
        },
      });
      if (!res.ok) throw new Error(res.error);
      ({ videoId: serverId, path, uploadToken } = res.data);
      item.serverId = serverId; item.path = path; item.uploadToken = uploadToken; item.resumable = {};
      patch(item.key, { serverId, path, uploadToken, resumable: item.resumable });
    }
    if (!item.uploaded) {
      patch(item.key, { step: "Envoi sécurisé…", progress: 0 });
      await uploadResumable({ ...config, bucket: "request-media", path: path!, token: uploadToken! }, prepared.blob, prepared.mimeType, item.resumable,
        (s, t) => patch(item.key, { progress: s / t }));
      const conf = await confirmVideoAction(slug, { videoId: serverId!, duration: prepared.duration && Number.isFinite(prepared.duration) ? prepared.duration : undefined, width: prepared.width, height: prepared.height });
      if (!conf.ok) { item.serverId = undefined; patch(item.key, { serverId: undefined }); throw new Error(conf.error); }
      item.uploaded = true;
      patch(item.key, { uploaded: true });
    }
    let count = 0;
    if (frames.length > 0) {
      patch(item.key, { step: "Envoi des images…", progress: 0 });
      const slots = await prepareFramesAction(slug, serverId!, frames.length);
      if (!slots.ok) throw new Error(slots.error);
      const done: Array<{ path: string; capturedAtMs: number; width: number; height: number }> = [];
      for (const [i, slot] of slots.data.entries()) {
        await uploadSmall({ ...config, bucket: "request-media", path: slot.path, token: slot.uploadToken }, frames[i].blob, "image/jpeg");
        done.push({ path: slot.path, capturedAtMs: frames[i].time * 1000, width: frames[i].width, height: frames[i].height });
        patch(item.key, { progress: (i + 1) / slots.data.length });
      }
      const saved = await confirmFramesAction(slug, serverId!, done);
      if (!saved.ok) throw new Error(saved.error);
      count = saved.data.count;
    }
    return { id: serverId!, size: prepared.blob.size, frames: count, processing: prepared.processing, original: prepared.original.size };
  }

  async function processPhoto(item: Item) {
    patch(item.key, { status: "processing", step: "Préparation…", progress: 0.1, error: undefined });
    const photo = await preparePhoto(item.file);
    const res = await preparePhotoAction(slug, { size: photo.blob.size, originalMimeType: photo.originalMimeType, width: photo.width, height: photo.height });
    if (!res.ok) throw new Error(res.error);
    patch(item.key, { step: "Envoi…", progress: 0.5 });
    await uploadSmall({ ...config, bucket: "request-media", path: res.data.path, token: res.data.uploadToken }, photo.blob, "image/jpeg");
    const conf = await confirmPhotoAction(slug, { photoId: res.data.videoId, width: photo.width, height: photo.height });
    if (!conf.ok) throw new Error(conf.error);
    return { id: res.data.videoId, size: photo.blob.size, frames: 1, processing: "compressed", original: photo.originalSize };
  }

  async function sendAll() {
    setRunning(true);
    setMessage(null);
    // Envoi l'un après l'autre : la compression vidéo mobilise l'encodeur du téléphone.
    for (const item of itemsRef.current.filter((i) => i.status === "selected" || i.status === "error")) {
      try {
        const done = item.kind === "video" ? await processVideo(item) : await processPhoto(item);
        patch(item.key, { status: "uploaded", progress: 1, step: undefined });
        setSent((list) => [...list, { id: done.id, kind: item.kind, status: "uploaded", size_bytes: done.size, duration_seconds: null, processing: done.processing, original_size_bytes: done.original, frames: done.frames }]);
      } catch (error) {
        const text = error instanceof VideoProcessingError || error instanceof PhotoProcessingError || error instanceof UploadError || error instanceof Error ? error.message : "Un problème est survenu.";
        patch(item.key, { status: "error", error: text, step: undefined });
      }
    }
    setItems((list) => {
      list.filter((i) => i.status === "uploaded").forEach((i) => URL.revokeObjectURL(i.previewUrl));
      return list.filter((i) => i.status !== "uploaded");
    });
    setRunning(false);
    router.refresh();
  }

  async function removeSent(video: DraftVideo) {
    if (!window.confirm(video.kind === "photo" ? "Supprimer cette photo ?" : "Supprimer cette vidéo ?")) return;
    const res = await discardVideoAction(slug, video.id);
    if (!res.ok) return setMessage(res.error);
    setSent((list) => list.filter((v) => v.id !== video.id));
    router.refresh();
  }

  const onCameraError = useCallback((kind: CameraError) => { setCamera(false); setCameraError(kind); }, []);
  const pending = items.filter((i) => i.status !== "uploaded");
  const videosSent = sent.filter((v) => v.kind !== "photo");
  const photosSent = sent.filter((v) => v.kind === "photo");

  return (
    <div className="flex flex-col gap-6">
      {message ? <Alert tone="danger" title={message} /> : null}
      {cameraError ? <Alert tone="warning" title={CAMERA_ERRORS[cameraError].title}>{CAMERA_ERRORS[cameraError].text}</Alert> : null}

      {mode === "choose" ? (
        <section aria-labelledby="media-choices" className="flex flex-col gap-3">
          <h2 id="media-choices" className="sr-only">Comment souhaitez-vous montrer votre logement ?</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            <ChoiceCard icon={Camera} title="Filmer mon logement" text="La caméra de votre téléphone s'ouvre. Plusieurs séquences possibles." onClick={() => { setCameraError(null); setMode("film"); }} testId="media-film" />
            <ChoiceCard icon={Film} title="Importer une ou plusieurs vidéos" text="Choisissez des vidéos déjà enregistrées dans votre galerie." onClick={() => videoInput.current?.click()} testId="media-videos" />
            <ChoiceCard icon={ImagePlus} title="Importer des photos" text="Sélectionnez plusieurs photos de vos pièces et de vos meubles." onClick={() => photoInput.current?.click()} testId="media-photos" />
          </div>
          <p className="text-sm text-ink-secondary">Vous pouvez combiner vidéos et photos, et filmer tout le logement en une seule fois ou en plusieurs séquences : nous analysons l&apos;ensemble et chaque meuble n&apos;est compté qu&apos;une fois.</p>
        </section>
      ) : (
        <section aria-labelledby="film-tips" className="flex flex-col gap-4 rounded-lg border border-brand/40 bg-brand-soft/40 p-4 sm:p-6">
          <h2 id="film-tips" className="text-lg leading-[26px] font-semibold">Avant de filmer</h2>
          <ul className="grid gap-1.5 text-sm">{TIPS.map((t) => <li key={t} className="flex gap-2"><CheckCircle2 aria-hidden className="mt-0.5 size-4 shrink-0 text-brand" />{t}</li>)}</ul>
          <p className="text-sm text-ink-secondary">Une seule vidéo pour tout le logement ou une vidéo par pièce : comme vous préférez. Chaque séquence dure 2 minutes au plus ; vous pouvez en enregistrer plusieurs.</p>
          <div className="flex flex-col gap-2 sm:flex-row">
            {cameraError !== "unsupported" && cameraError !== "unavailable" ? (
              <Button size="lg" onClick={() => { setCameraError(null); setCamera(true); }}><Camera aria-hidden />{items.some((i) => i.source === "camera") || videosSent.length > 0 ? "Filmer une autre séquence" : "Ouvrir la caméra"}</Button>
            ) : null}
            {cameraError ? <Button size="lg" variant="secondary" onClick={() => nativeInput.current?.click()}><Camera aria-hidden />Utiliser l&apos;appareil photo du téléphone</Button> : null}
            <Button size="lg" variant="tertiary" onClick={() => setMode("choose")}>Autres options</Button>
          </div>
        </section>
      )}

      {pending.length > 0 ? (
        <section aria-labelledby="selection-title" className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4 sm:p-6" data-testid="media-selection">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="selection-title" className="text-lg leading-[26px] font-semibold">Votre sélection ({pending.length})</h2>
            <span className="text-sm text-ink-secondary">Vérifiez vos médias, retirez ceux qui ne conviennent pas, puis validez.</span>
          </div>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {pending.map((i) => (
              <li key={i.key} className="flex flex-col gap-2 rounded-md border border-border p-2" data-testid="media-pending">
                {i.kind === "video" ? (
                  <video src={i.previewUrl} controls playsInline preload="metadata" className="aspect-video w-full rounded-sm bg-media" />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={i.previewUrl} alt={i.name} className="aspect-video w-full rounded-sm bg-media object-cover" />
                )}
                <span className="truncate text-xs text-ink-secondary">{i.kind === "video" ? "Vidéo" : "Photo"} · {i.name}</span>
                {i.status === "processing" ? (
                  <span className="flex flex-col gap-1" role="status" aria-live="polite">
                    <span className="flex justify-between text-xs"><span>{i.step}</span><span className="tabular-nums">{Math.round((i.progress ?? 0) * 100)} %</span></span>
                    <span className="h-1.5 overflow-hidden rounded-full bg-surface-subtle"><span className="block h-full rounded-full bg-brand transition-[width]" style={{ width: `${Math.round((i.progress ?? 0) * 100)}%` }} /></span>
                  </span>
                ) : i.status === "error" ? (
                  <span className="text-xs text-danger-text">{i.error}</span>
                ) : null}
                {!running ? (
                  <button type="button" onClick={() => removeSelected(i.key)} className="inline-flex min-h-10 items-center justify-center gap-1 rounded-md text-sm text-danger-text hover:bg-danger-soft">
                    <Trash2 aria-hidden className="size-4" />Retirer
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button size="lg" onClick={sendAll} disabled={running} data-testid="media-send">
              {running ? <><Loader2 aria-hidden className="animate-spin" />Envoi en cours…</> : pending.some((p) => p.status === "error") ? <><RotateCcw aria-hidden />Réessayer l&apos;envoi</> : <><Upload aria-hidden />Valider et envoyer</>}
            </Button>
            {!running ? (
              <>
                <Button variant="secondary" onClick={() => videoInput.current?.click()}><Video aria-hidden />Ajouter des vidéos</Button>
                <Button variant="secondary" onClick={() => photoInput.current?.click()}><ImageIcon aria-hidden />Ajouter des photos</Button>
              </>
            ) : null}
          </div>
          {running ? <p className="text-xs text-ink-muted">Ne fermez pas cette page pendant l&apos;envoi.</p> : null}
        </section>
      ) : null}

      {sent.length > 0 ? (
        <section aria-labelledby="sent-title" className="flex flex-col gap-3" data-testid="media-sent">
          <h2 id="sent-title" className="text-lg leading-[26px] font-semibold">Médias envoyés</h2>
          <p className="text-sm text-ink-secondary">
            {videosSent.length} vidéo{videosSent.length > 1 ? "s" : ""} · {photosSent.length} photo{photosSent.length > 1 ? "s" : ""}
          </p>
          <ul className="flex flex-col divide-y divide-border rounded-lg border border-border bg-surface">
            {sent.map((v, n) => <SentRow key={v.id} slug={slug} video={v} index={n + 1} onRemove={() => removeSent(v)} disabled={running} />)}
          </ul>
        </section>
      ) : null}

      {sent.length > 0 && pending.length === 0 ? (
        <ButtonLink href={stepHref(slug, "recapitulatif")} size="lg" block>Continuer vers le récapitulatif</ButtonLink>
      ) : sent.length > 0 ? (
        <p className="text-center text-sm text-ink-muted">Envoyez ou retirez les médias sélectionnés pour continuer.</p>
      ) : null}

      <input ref={videoInput} type="file" multiple accept="video/mp4,video/quicktime,video/webm,video/*" className="sr-only" tabIndex={-1} aria-hidden="true" data-input="videos"
        onChange={(e) => { const f = e.target.files; if (f?.length) void addFiles(f, "video", "gallery"); e.target.value = ""; }} />
      <input ref={photoInput} type="file" multiple accept="image/*,.heic,.heif" className="sr-only" tabIndex={-1} aria-hidden="true" data-input="photos"
        onChange={(e) => { const f = e.target.files; if (f?.length) void addFiles(f, "photo", "gallery"); e.target.value = ""; }} />
      <input ref={nativeInput} type="file" accept="video/*" capture="environment" className="sr-only" tabIndex={-1} aria-hidden="true" data-input="native"
        onChange={(e) => { const f = e.target.files; if (f?.length) void addFiles(f, "video", "native_camera"); e.target.value = ""; }} />

      {camera ? (
        <CameraRecorder roomName="Votre logement" onCapture={(blob) => { setCamera(false); void addFiles([blob], "video", "camera"); }} onClose={() => setCamera(false)} onError={onCameraError} />
      ) : null}
    </div>
  );
}

function ChoiceCard({ icon: Icon, title, text, onClick, testId }: { icon: typeof Camera; title: string; text: string; onClick: () => void; testId: string }) {
  return (
    <button type="button" onClick={onClick} data-testid={testId}
      className="flex flex-col items-start gap-3 rounded-xl border-2 border-border bg-surface p-5 text-left transition-colors hover:border-brand/60 focus-visible:border-brand focus-visible:outline-none">
      <span className="flex size-12 items-center justify-center rounded-full bg-brand-soft text-brand"><Icon aria-hidden className="size-6" /></span>
      <span className="text-lg leading-[26px] font-bold">{title}</span>
      <span className="text-sm text-ink-secondary">{text}</span>
    </button>
  );
}

function SentRow({ slug, video, index, onRemove, disabled }: { slug: string; video: DraftVideo; index: number; onRemove: () => void; disabled: boolean }) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const photo = video.kind === "photo";
  async function show() {
    const res = await videoPreviewAction(slug, video.id);
    if (res.ok) setUrl(res.data.url);
    else setError(res.error);
  }
  return (
    <li className="flex flex-col gap-2 px-4 py-3" data-testid="media-sent-item">
      <div className="flex items-center gap-3">
        {photo ? <ImageIcon aria-hidden className="size-5 shrink-0 text-success" /> : <Film aria-hidden className="size-5 shrink-0 text-success" />}
        <span className="min-w-0 flex-1 text-sm">
          <span className="block font-medium">{photo ? `Photo ${index}` : `Vidéo ${index}`}</span>
          <span className="text-ink-muted">
            {video.size_bytes ? formatBytes(video.size_bytes) : ""}
            {!photo && video.frames ? ` · ${video.frames} image${video.frames > 1 ? "s" : ""} pour l'analyse` : ""}
            {!photo && video.frames === 0 ? " · aucune image extraite" : ""}
          </span>
        </span>
        {!url ? <Button size="sm" variant="tertiary" onClick={show}>Revoir</Button> : null}
        <button type="button" onClick={onRemove} disabled={disabled} aria-label={`Supprimer ${photo ? "la photo" : "la vidéo"} ${index}`}
          className="inline-grid size-11 place-items-center rounded-md text-ink-secondary hover:bg-danger-soft hover:text-danger-text disabled:opacity-40">
          <Trash2 aria-hidden className="size-[18px]" />
        </button>
      </div>
      {error ? <span className="text-xs text-danger-text">{error}</span> : null}
      {url ? (photo
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={url} alt={`Photo ${index}`} className={cn("max-h-64 w-full rounded-md object-contain bg-media")} />
        : <video src={url} controls playsInline preload="metadata" className="aspect-video w-full rounded-md bg-media" />) : null}
    </li>
  );
}
