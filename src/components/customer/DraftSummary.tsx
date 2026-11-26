import Link from "next/link";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { ELEVATOR_LABELS, HOUSING_LABELS, floorLabel, formatDate } from "@/lib/requests/labels";
import { stepHref } from "@/lib/public-request/steps";
import { formatBytes } from "@/lib/video/signature";
import type { Draft, DraftDwelling, PublicInventoryItem } from "@/lib/public-request/service";

function Section({ title, edit, children }: { title: string; edit?: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg leading-[26px] font-semibold">{title}</h2>
        {edit && <Link href={edit} className="inline-flex min-h-11 items-center px-2 text-sm font-medium text-brand hover:underline">Modifier</Link>}
      </div>
      {children}
    </section>
  );
}

function dwellingLines(d?: DraftDwelling) {
  if (!d) return ["Non renseigné"];
  const address = [d.address_line, [d.postal_code, d.city].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  const facts = [
    d.housing_type ? HOUSING_LABELS[d.housing_type as keyof typeof HOUSING_LABELS] : null,
    d.surface_m2 ? `${d.surface_m2} m²` : null,
    d.room_count !== null && d.room_count !== undefined ? `${d.room_count} pièce${d.room_count > 1 ? "s" : ""}` : null,
    floorLabel(d.floor),
    d.elevator ? ELEVATOR_LABELS[d.elevator as keyof typeof ELEVATOR_LABELS] : null,
    d.carrying_distance_m ? `portage ${d.carrying_distance_m} m` : null,
  ].filter(Boolean);
  return [address, facts.join(" · "), d.access_notes && `Accès : ${d.access_notes}`, d.parking_notes && `Contraintes : ${d.parking_notes}`].filter(Boolean) as string[];
}

/** Parcours v3 : vidéos et photos du logement, sans pièce. */
function MediaSection({ draft, edit }: { draft: Draft; edit?: string }) {
  const media = draft.rooms.flatMap((r) => r.videos);
  const videos = media.filter((m) => m.kind !== "photo");
  const photos = media.filter((m) => m.kind === "photo");
  const frames = videos.reduce((n, v) => n + v.frames, 0) + photos.length;
  return (
    <Section title="Vidéos et photos" edit={edit}>
      <p className="flex items-start gap-3 rounded-md bg-canvas px-3 py-2.5 text-sm">
        {media.length > 0 ? <CheckCircle2 aria-hidden className="mt-0.5 size-[18px] shrink-0 text-success" /> : <AlertTriangle aria-hidden className="mt-0.5 size-[18px] shrink-0 text-warning" />}
        <span>
          {media.length === 0 ? "Aucune vidéo ni photo" : `${videos.length} vidéo${videos.length > 1 ? "s" : ""} · ${photos.length} photo${photos.length > 1 ? "s" : ""}`}
          {media.length > 0 ? <span className="block text-ink-muted">{frames} image{frames > 1 ? "s" : ""} pour l&apos;analyse · {formatBytes(media.reduce((n, m) => n + (m.size_bytes ?? 0), 0))}</span> : null}
        </span>
      </p>
    </Section>
  );
}

/** Récapitulatif complet de la demande (utilisé avant l'envoi et après). */
export function DraftSummary({ slug, draft, editable, inventory }: { slug: string; draft: Draft; editable: boolean; inventory?: PublicInventoryItem[] }) {
  const edit = (key: Parameters<typeof stepHref>[1]) => (editable ? stepHref(slug, key, draft.inventory_method) : undefined);
  const c = draft.customer;
  const alternatives = draft.alternative_moving_dates?.length ? draft.alternative_moving_dates : draft.alternative_moving_date ? [draft.alternative_moving_date] : [];
  const manual = draft.inventory_method === "manual";
  const byRoom = new Map<string, PublicInventoryItem[]>();
  for (const i of inventory ?? []) byRoom.set(i.room, [...(byRoom.get(i.room) ?? []), i]);
  const totalM3 = (inventory ?? []).reduce((sum, i) => sum + i.quantity * Number(i.unit_volume_m3), 0);
  return (
    <div className="flex flex-col gap-4">
      <Section title="Déménagement" edit={edit("trajet")}>
        <dl className="grid gap-2 text-sm">
          <div><dt className="inline text-ink-secondary">Date souhaitée : </dt><dd className="inline font-medium">{formatDate(draft.moving_date)}</dd></div>
          {alternatives.length > 0 && (
            <div><dt className="inline text-ink-secondary">{alternatives.length > 1 ? "Dates alternatives" : "Date alternative"} : </dt><dd className="inline font-medium">{alternatives.map(formatDate).join(", ")}</dd></div>
          )}
          {draft.moving_date_flexible && <div className="text-ink-secondary">Dates flexibles</div>}
        </dl>
        {(["origin", "destination"] as const).map((k) => (
          <div key={k} className="flex flex-col gap-0.5 rounded-md bg-canvas px-3 py-2.5 text-sm">
            <span className="font-semibold">{k === "origin" ? "Départ" : "Arrivée"}</span>
            {dwellingLines(draft.dwellings[k]).map((line, i) => <span key={i} className={i === 0 ? "text-ink" : "text-ink-secondary"}>{line}</span>)}
          </div>
        ))}
      </Section>
      <Section title="Coordonnées" edit={edit("coordonnees")}>
        <dl className="grid gap-1 text-sm">
          {c?.type === "company" ? (
            <div><dt className="inline text-ink-secondary">Entreprise : </dt><dd className="inline font-medium">{c.company_name}{c.siret ? ` · SIRET ${c.siret}` : ""}</dd></div>
          ) : null}
          <div><dt className="inline text-ink-secondary">{c?.type === "company" ? "Contact" : "Nom"} : </dt><dd className="inline font-medium">{c?.full_name}</dd></div>
          <div><dt className="inline text-ink-secondary">E-mail : </dt><dd className="inline font-medium">{c?.email}</dd></div>
          {c?.phone ? <div><dt className="inline text-ink-secondary">Téléphone : </dt><dd className="inline font-medium">{c.phone}</dd></div> : null}
        </dl>
      </Section>
      {manual ? (
        <Section title={`Inventaire (${(inventory ?? []).reduce((n, i) => n + i.quantity, 0)} objets · ${totalM3.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} m³)`} edit={edit("inventaire")}>
          {[...byRoom.entries()].map(([room, items]) => (
            <div key={room} className="rounded-md bg-canvas px-3 py-2.5 text-sm">
              <p className="font-semibold">{room}</p>
              <ul>
                {items.map((i) => (
                  <li key={i.id} className="flex justify-between gap-2"><span>{i.name}</span><span className="tabular-nums text-ink-secondary">× {i.quantity}</span></li>
                ))}
              </ul>
            </div>
          ))}
        </Section>
      ) : draft.rooms.every((r) => r.room_type === "logement") ? (
        <MediaSection draft={draft} edit={edit("medias")} />
      ) : (
      <Section title={`Pièces et vidéos (${draft.rooms.length})`} edit={edit("medias")}>
        <ul className="flex flex-col gap-2">
          {draft.rooms.map((room) => {
            const video = room.videos[0];
            return (
              <li key={room.id} className="flex items-start gap-3 rounded-md bg-canvas px-3 py-2.5 text-sm">
                {room.videos.length > 0 ? (
                  <CheckCircle2 aria-hidden className="mt-0.5 size-[18px] shrink-0 text-success" />
                ) : (
                  <AlertTriangle aria-hidden className="mt-0.5 size-[18px] shrink-0 text-warning" />
                )}
                <div className="min-w-0">
                  <p className="font-medium">{room.name}</p>
                  {room.description && <p className="text-ink-secondary">{room.description}</p>}
                  <p className={room.videos.length ? "text-ink-muted" : "text-warning-text"}>
                    {video
                      ? `${room.videos.length} vidéo${room.videos.length > 1 ? "s" : ""}${video.size_bytes ? ` · ${formatBytes(video.size_bytes)}` : ""}${video.frames ? ` · ${video.frames} images` : ""}`
                      : "Pas de vidéo pour cette pièce"}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      </Section>
      )}
    </div>
  );
}
