import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ClipboardList, Mail, Phone, Video } from "lucide-react";
import { requireMembership } from "@/lib/auth/dal";
import { getRequestDetail, toInventoryItems, type DwellingRow } from "@/lib/data/requests";
import { requestReference, STATUS_META } from "@/lib/requests/status";
import { ELEVATOR_LABELS, HOUSING_LABELS, floorLabel, formatDate, formatDateTime } from "@/lib/requests/labels";
import { summarizeVolume } from "@/lib/inventory/volume";
import { RequestStatusBadge } from "@/components/requests/RequestStatusBadge";
import { InventoryTable } from "@/components/inventory/InventoryTable";
import { VolumeSummaryCard } from "@/components/inventory/VolumeSummaryCard";
import { Card, CardHeader } from "@/components/ui/Card";
import { Alert } from "@/components/ui/Alert";
import { EmptyState } from "@/components/ui/EmptyState";
import { Badge } from "@/components/ui/Badge";
import { NotesForm, StatusForm } from "./RequestForms";
import { createClient } from "@/lib/supabase/server";
import { signedMediaUrl } from "@/lib/storage/media";

export const metadata: Metadata = { title: "Demande" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function DwellingCard({ title, d }: { title: string; d: DwellingRow | undefined }) {
  if (!d) {
    return (
      <div className="rounded-md bg-canvas px-4 py-3">
        <p className="font-semibold">{title}</p>
        <p className="text-sm text-ink-muted">Non renseigné</p>
      </div>
    );
  }
  const address = [d.address_line, [d.postal_code, d.city].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  const facts = [
    d.housing_type ? HOUSING_LABELS[d.housing_type] : null,
    floorLabel(d.floor),
    d.elevator ? ELEVATOR_LABELS[d.elevator] : "Ascenseur non précisé",
    d.carrying_distance_m !== null ? `Portage ${d.carrying_distance_m} m` : null,
  ].filter(Boolean);
  return (
    <div className="flex flex-col gap-1 rounded-md bg-canvas px-4 py-3">
      <p className="font-semibold">{title}</p>
      <p className="text-sm text-ink">{address || "Adresse non précisée"}</p>
      <p className="text-sm text-ink-secondary">{facts.join(" · ")}</p>
      {d.access_notes && <p className="text-sm text-ink-secondary">Accès : {d.access_notes}</p>}
    </div>
  );
}

export default async function RequestDetailPage({ params, searchParams }: PageProps<"/espace/demandes/[id]">) {
  const { company } = await requireMembership();
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const request = await getRequestDetail(company.id, id);
  if (!request) notFound();
  const { message } = await searchParams;

  const origin = request.dwellings.find((d) => d.kind === "origin");
  const destination = request.dwellings.find((d) => d.kind === "destination");
  const rooms = [...request.rooms].sort((a, b) => a.position - b.position);
  const roomNames = new Map(rooms.map((r) => [r.id, r.name]));
  const items = toInventoryItems(request.inventory_items, roomNames);
  const summary = summarizeVolume(items);
  const events = [...request.request_events].sort((a, b) => b.created_at.localeCompare(a.created_at));

  // Liens de lecture temporaires, créés avec la session de l'utilisateur (règles de stockage appliquées).
  const supabase = await createClient();
  const playable = rooms.flatMap((r) => r.room_videos).filter((v) => !v.deleted_at && ["uploaded", "processing", "ready"].includes(v.status));
  const videoUrls = new Map(
    await Promise.all(playable.map(async (v) => [v.id, await signedMediaUrl(supabase, v.storage_path)] as const)),
  );

  return (
    <>
      <Link href="/espace/demandes" className="-mb-4 text-sm font-medium text-brand hover:underline">← Demandes</Link>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-2">
          <p className="text-sm text-ink-muted tabular-nums">
            {requestReference(company.request_reference_prefix, request.request_number)} · reçue le {formatDate(request.submitted_at ?? request.created_at)}
          </p>
          <h1 className="text-[26px] leading-[34px] font-bold sm:text-[30px] sm:leading-[38px]">{request.customer?.full_name ?? "Client sans nom"}</h1>
          <div className="flex flex-wrap items-center gap-2">
            <RequestStatusBadge status={request.status} />
            <Badge>{request.source === "mover_manual" ? "Saisie manuelle" : "Lien client"}</Badge>
          </div>
        </div>
      </div>
      {message === "creee" && <Alert tone="success" title="Demande créée." />}

      <div className="grid items-start gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="flex min-w-0 flex-col gap-6">
          <Card as="section">
            <CardHeader title="Déménagement" />
            <p className="text-sm text-ink-secondary">
              Date souhaitée : <span className="font-medium text-ink">{formatDate(request.moving_date)}</span>
              {request.moving_date_flexible && " (flexible)"}
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <DwellingCard title="Départ" d={origin} />
              <DwellingCard title="Arrivée" d={destination} />
            </div>
            {request.customer_notes && (
              <p className="rounded-md bg-canvas px-4 py-3 text-sm text-ink-secondary">« {request.customer_notes} »</p>
            )}
          </Card>

          <section className="flex flex-col gap-3" aria-labelledby="inventory-title">
            <h2 id="inventory-title" className="text-[22px] leading-[30px] font-bold">Inventaire</h2>
            {items.length === 0 ? (
              <EmptyState icon={<ClipboardList />} title="Inventaire vide">
                {rooms.length === 0
                  ? "Aucune vidéo n'a été transmise pour cette demande. L'inventaire apparaîtra ici après l'analyse des vidéos du client."
                  : "L'analyse des vidéos n'a pas encore produit d'inventaire."}
              </EmptyState>
            ) : (
              <>
                <VolumeSummaryCard summary={summary} audience="pro" />
                <InventoryTable items={items} />
              </>
            )}
          </section>

          <Card as="section">
            <CardHeader title="Pièces et vidéos" />
            {rooms.length === 0 ? (
              <p className="flex items-center gap-2 text-sm text-ink-secondary">
                <Video aria-hidden className="size-4 text-ink-muted" />Aucune pièce filmée pour cette demande.
              </p>
            ) : (
              <ul className="flex flex-col gap-4">
                {rooms.map((room) => {
                  const videos = room.room_videos.filter((v) => !v.deleted_at && videoUrls.has(v.id));
                  const purged = room.room_videos.filter((v) => v.deleted_at).length;
                  return (
                    <li key={room.id} className="flex flex-col gap-2 rounded-md bg-canvas p-3 text-sm">
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-medium">{room.name}</span>
                        <span className="text-ink-secondary">{videos.length === 0 ? "Pas de vidéo" : `${videos.length} vidéo${videos.length > 1 ? "s" : ""}`}</span>
                      </div>
                      {videos.map((v) => {
                        const url = videoUrls.get(v.id);
                        return (
                          <div key={v.id} className="flex flex-col gap-1">
                            {url ? (
                              <video controls preload="metadata" src={url} className="aspect-video w-full rounded-lg bg-media" />
                            ) : (
                              <p className="text-ink-muted">Vidéo indisponible.</p>
                            )}
                            {v.delete_after && <span className="text-xs text-ink-muted">Suppression automatique prévue le {formatDate(v.delete_after)}.</span>}
                          </div>
                        );
                      })}
                      {purged > 0 && <span className="text-xs text-ink-muted">{purged} vidéo{purged > 1 ? "s" : ""} supprimée{purged > 1 ? "s" : ""} (durée de conservation atteinte).</span>}
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>

        <div className="flex min-w-0 flex-col gap-6">
          <Card as="section">
            <CardHeader title="Suivi" />
            <StatusForm id={request.id} status={request.status} />
            <p className="text-xs text-ink-muted">{STATUS_META[request.status].description}</p>
          </Card>

          <Card as="section">
            <CardHeader title="Client" />
            <ul className="flex flex-col gap-2 text-sm">
              <li className="flex items-center gap-2">
                <Mail aria-hidden className="size-4 text-ink-muted" />
                {request.customer?.email ? <a href={`mailto:${request.customer.email}`} className="text-brand hover:underline">{request.customer.email}</a> : <span className="text-ink-muted">E-mail non renseigné</span>}
              </li>
              <li className="flex items-center gap-2">
                <Phone aria-hidden className="size-4 text-ink-muted" />
                {request.customer?.phone ? <a href={`tel:${request.customer.phone}`} className="text-brand hover:underline">{request.customer.phone}</a> : <span className="text-ink-muted">Téléphone non renseigné</span>}
              </li>
            </ul>
          </Card>

          <Card as="section">
            <NotesForm id={request.id} notes={request.internal_notes} />
          </Card>

          <Card as="section">
            <CardHeader title="Historique" />
            <ol className="flex flex-col gap-3">
              {events.map((e) => (
                <li key={e.id} className="flex flex-col gap-0.5 border-l-2 border-border pl-3 text-sm">
                  <span className="text-ink">
                    {e.event_type === "created"
                      ? "Demande créée"
                      : e.event_type === "status_changed" && e.to_status
                        ? `Statut : ${STATUS_META[e.to_status].label}`
                        : e.message}
                  </span>
                  <span className="text-xs text-ink-muted">{formatDateTime(e.created_at)}</span>
                </li>
              ))}
            </ol>
          </Card>
        </div>
      </div>
    </>
  );
}
