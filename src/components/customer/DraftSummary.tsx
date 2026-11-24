import Link from "next/link";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { ELEVATOR_LABELS, HOUSING_LABELS, floorLabel, formatDate } from "@/lib/requests/labels";
import { stepHref } from "@/lib/public-request/steps";
import { formatBytes } from "@/lib/video/signature";
import type { Draft, DraftDwelling } from "@/lib/public-request/service";

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

/** Récapitulatif complet de la demande (utilisé avant l'envoi et après). */
export function DraftSummary({ slug, draft, editable }: { slug: string; draft: Draft; editable: boolean }) {
  const edit = (key: Parameters<typeof stepHref>[1]) => (editable ? stepHref(slug, key) : undefined);
  return (
    <div className="flex flex-col gap-4">
      <Section title="Déménagement" edit={edit("trajet")}>
        <dl className="grid gap-2 text-sm">
          <div><dt className="inline text-ink-secondary">Date souhaitée : </dt><dd className="inline font-medium">{formatDate(draft.moving_date)}</dd></div>
          {draft.alternative_moving_date && <div><dt className="inline text-ink-secondary">Date alternative : </dt><dd className="inline font-medium">{formatDate(draft.alternative_moving_date)}</dd></div>}
          {draft.moving_date_flexible && <div className="text-ink-secondary">Dates flexibles</div>}
          <div><dt className="inline text-ink-secondary">Contact : </dt><dd className="inline font-medium">{draft.customer?.full_name} · {draft.customer?.email}{draft.customer?.phone ? ` · ${draft.customer.phone}` : ""}</dd></div>
        </dl>
      </Section>
      <Section title="Logements" edit={edit("logements")}>
        {(["origin", "destination"] as const).map((k) => (
          <div key={k} className="flex flex-col gap-0.5 rounded-md bg-canvas px-3 py-2.5 text-sm">
            <span className="font-semibold">{k === "origin" ? "Départ" : "Arrivée"}</span>
            {dwellingLines(draft.dwellings[k]).map((line, i) => <span key={i} className={i === 0 ? "text-ink" : "text-ink-secondary"}>{line}</span>)}
          </div>
        ))}
      </Section>
      <Section title={`Pièces et vidéos (${draft.rooms.length})`} edit={edit("videos")}>
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
    </div>
  );
}
