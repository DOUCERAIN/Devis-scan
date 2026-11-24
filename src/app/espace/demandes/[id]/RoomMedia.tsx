"use client";

import { useState } from "react";
import { Video } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { formatBytes } from "@/lib/video/signature";
import { formatDate } from "@/lib/requests/labels";

type Frame = { id: string; url: string | null; ms: number | null };
type MediaVideo = {
  id: string; url: string; mimeType: string | null; size: number | null; duration: number | null; width: number | null; height: number | null;
  processing: string | null; originalSize: number | null; source: string | null; deleteAfter: string | null; frames: Frame[];
};
type MediaRoom = { id: string; name: string; description: string | null; purged: number; videos: MediaVideo[] };

const SOURCE = { camera: "Filmée dans la page", native_camera: "Appareil photo du téléphone", gallery: "Vidéo existante" } as const;

function duration(s: number | null) {
  if (!s) return null;
  const n = Math.round(s);
  return `${Math.floor(n / 60)} min ${String(n % 60).padStart(2, "0")} s`;
}

function VideoBlock({ video }: { video: MediaVideo }) {
  const [frame, setFrame] = useState<Frame | null>(null);
  const facts = [
    duration(video.duration),
    video.width && video.height ? `${video.width}×${video.height}` : null,
    video.size ? formatBytes(video.size) : null,
    video.processing === "compressed" && video.originalSize ? `compressée (${formatBytes(video.originalSize)} à l'origine)` : video.processing === "original" ? "non compressée" : null,
    video.source ? SOURCE[video.source as keyof typeof SOURCE] : null,
  ].filter(Boolean);
  return (
    <div className="flex flex-col gap-2">
      <video controls playsInline preload="metadata" className="aspect-video w-full rounded-lg bg-media">
        <source src={video.url} type={video.mimeType ?? undefined} />
        Votre navigateur ne peut pas lire cette vidéo.
      </video>
      <p className="text-xs text-ink-muted">{facts.join(" · ")}</p>
      {video.frames.length > 0 ? (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold tracking-[0.06em] text-ink-secondary uppercase">Images extraites ({video.frames.length})</p>
          <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-6">
            {video.frames.map((f, i) =>
              f.url ? (
                <button key={f.id} type="button" onClick={() => setFrame(frame?.id === f.id ? null : f)}
                  className="overflow-hidden rounded-sm ring-brand focus-visible:ring-2 data-[active=true]:ring-2" data-active={frame?.id === f.id}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={f.url} alt={`Image ${i + 1}${f.ms !== null ? ` à ${Math.round(f.ms / 1000)} s` : ""}`} className="aspect-video w-full object-cover" loading="lazy" />
                </button>
              ) : null,
            )}
          </div>
          {frame?.url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={frame.url} alt="Image sélectionnée" className="w-full rounded-lg border border-border" />
          )}
        </div>
      ) : (
        <p className="text-xs text-ink-muted">Aucune image extraite pour cette vidéo.</p>
      )}
      {video.deleteAfter && <p className="text-xs text-ink-muted">Suppression automatique prévue le {formatDate(video.deleteAfter)}.</p>}
    </div>
  );
}

/** Pièces de la demande, avec lecteur vidéo et images extraites (liens temporaires). */
export function RoomMedia({ rooms }: { rooms: MediaRoom[] }) {
  return (
    <Card as="section">
      <CardHeader title={`Pièces et vidéos (${rooms.length})`} />
      {rooms.length === 0 ? (
        <p className="flex items-center gap-2 text-sm text-ink-secondary"><Video aria-hidden className="size-4 text-ink-muted" />Aucune pièce filmée pour cette demande.</p>
      ) : (
        <ul className="flex flex-col gap-4">
          {rooms.map((room) => (
            <li key={room.id} className="flex flex-col gap-3 rounded-md bg-canvas p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-semibold">{room.name}</span>
                {room.videos.length === 0 ? <Badge tone="warning">Pas de vidéo</Badge> : <Badge tone="success">{room.videos.length} vidéo{room.videos.length > 1 ? "s" : ""}</Badge>}
              </div>
              {room.description && <p className="text-sm text-ink-secondary">« {room.description} »</p>}
              {room.videos.map((v) => <VideoBlock key={v.id} video={v} />)}
              {room.purged > 0 && <p className="text-xs text-ink-muted">{room.purged} vidéo{room.purged > 1 ? "s" : ""} supprimée{room.purged > 1 ? "s" : ""} (durée de conservation atteinte).</p>}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
