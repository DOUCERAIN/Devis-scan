import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ClipboardList, Mail, Phone } from "lucide-react";
import { requireMembership } from "@/lib/auth/dal";
import { getRequestDetail, toInventoryItems, type DwellingRow } from "@/lib/data/requests";
import { requestReference, STATUS_META } from "@/lib/requests/status";
import { ELEVATOR_LABELS, HOUSING_LABELS, floorLabel, formatDate, formatDateTime } from "@/lib/requests/labels";
import { summarizeVolume } from "@/lib/inventory/volume";
import { RequestStatusBadge } from "@/components/requests/RequestStatusBadge";
import { VolumeSummaryCard } from "@/components/inventory/VolumeSummaryCard";
import { Card, CardHeader } from "@/components/ui/Card";
import { Alert } from "@/components/ui/Alert";
import { EmptyState } from "@/components/ui/EmptyState";
import { Badge } from "@/components/ui/Badge";
import { NotesForm, StatusForm } from "./RequestForms";
import { createClient } from "@/lib/supabase/server";
import { signedMediaUrl, signedMediaUrls } from "@/lib/storage/media";
import { RoomMedia } from "./RoomMedia";
import { InventoryEditor, type EditableItem } from "./InventoryEditor";
import { QuoteActions } from "./QuoteActions";
import { formatEuros } from "@/lib/pricing/engine";
import { formatCostUsd } from "@/lib/ai/cost";
import { QUOTE_STATUS_META } from "@/lib/requests/quote-status";

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
    d.surface_m2 ? `${d.surface_m2} m²` : null,
    d.room_count !== null ? `${d.room_count} pièce${d.room_count > 1 ? "s" : ""}` : null,
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
      {d.parking_notes && <p className="text-sm text-ink-secondary">Contraintes : {d.parking_notes}</p>}
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
  const supabase = await createClient();
  const editable: EditableItem[] = request.inventory_items
    .map((r, i) => ({ r, base: items[i] }))
    .filter(({ r }) => !r.merged_into_item_id)
    .map(({ r, base }) => ({
      ...base,
      aiLabel: r.ai_label,
      roomId: r.room_id,
      validatedByHuman: r.validated_by_human,
      possibleDuplicate: r.possible_duplicate,
      duplicateReason: r.duplicate_reason,
      removed: r.removed,
      volumeSource: r.volume_source,
      isHeavy: r.is_heavy,
      frames: r.inventory_item_frames?.length ?? 0,
    }))
    .sort((a, b) => a.room.localeCompare(b.room) || a.name.localeCompare(b.name));
  const [{ data: quotes }, { data: runs }, { data: changes }, { data: pricing }, { data: catalogRows }] = await Promise.all([
    supabase.from("quotes").select("id, version, status, kind, origin, total_ttc_cents, created_at, sent_at, accepted_at, changes_summary, review_reasons").eq("request_id", request.id).order("version", { ascending: false }),
    supabase.from("analysis_runs").select("id, status, stage, provider, model, simulated, rooms_total, rooms_done, images_count, input_tokens, output_tokens, cost_usd, error_code, error_message, created_at, finished_at").eq("request_id", request.id).order("created_at", { ascending: false }).limit(3),
    supabase.from("inventory_item_changes").select("id, action, changes, volume_before_m3, volume_after_m3, changed_at, item_id").eq("request_id", request.id).order("changed_at", { ascending: false }).limit(30),
    supabase.from("pricing_settings").select("configured_at").eq("company_id", company.id).maybeSingle(),
    supabase.from("furniture_catalog").select("id, name, category_label").order("category_label").order("name"),
  ]);
  const run = runs?.[0] ?? null;
  const itemNames = new Map(request.inventory_items.map((i) => [i.id, i.name]));
  const catalog = (catalogRows ?? []).map((c) => ({ value: c.id, label: `${c.category_label} · ${c.name}` }));
  const events = [...request.request_events].sort((a, b) => b.created_at.localeCompare(a.created_at));

  // Liens de lecture temporaires, créés avec la session de l'utilisateur (règles de stockage appliquées).
  const playable = rooms.flatMap((r) => r.room_videos).filter((v) => !v.deleted_at && ["uploaded", "processing", "ready"].includes(v.status));
  const videoUrls = new Map(
    await Promise.all(playable.map(async (v) => [v.id, await signedMediaUrl(supabase, v.storage_path)] as const)),
  );
  const frameUrls = await signedMediaUrls(supabase, playable.flatMap((v) => v.video_frames.map((f) => f.storage_path)));

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
              {request.alternative_moving_date && <> · date alternative : <span className="font-medium text-ink">{formatDate(request.alternative_moving_date)}</span></>}
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
                <InventoryEditor
                  requestId={request.id}
                  items={editable}
                  rooms={rooms.map((r) => ({ value: r.id, label: r.name }))}
                  catalog={catalog}
                />
              </>
            )}
            {items.length === 0 ? (
              <InventoryEditor requestId={request.id} items={[]} rooms={rooms.map((r) => ({ value: r.id, label: r.name }))} catalog={catalog} />
            ) : null}
          </section>

          {changes && changes.length > 0 ? (
            <Card as="section">
              <CardHeader title="Corrections de l'inventaire" />
              <ol className="flex flex-col gap-2 text-sm">
                {changes.map((c) => {
                  const delta = Number(c.volume_after_m3 ?? 0) - Number(c.volume_before_m3 ?? 0);
                  return (
                    <li key={c.id} className="flex flex-wrap justify-between gap-2 border-l-2 border-border pl-3">
                      <span>
                        {{ add: "Ajout", update: "Modification", remove: "Retrait", restore: "Rétablissement", merge: "Fusion", confirm: "Confirmation" }[c.action] ?? c.action}
                        {" : "}
                        {(c.item_id && itemNames.get(c.item_id)) || "objet"}
                        {c.action === "update" && c.changes && typeof c.changes === "object" && !Array.isArray(c.changes)
                          ? ` (${Object.entries(c.changes as Record<string, { avant: unknown; apres: unknown }>).map(([k, v]) => `${k} : ${String(v.avant)} → ${String(v.apres)}`).join(", ")})`
                          : ""}
                      </span>
                      <span className="text-ink-muted tabular-nums">
                        {delta !== 0 ? `${delta > 0 ? "+" : ""}${delta.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} m³ · ` : ""}
                        {formatDateTime(c.changed_at)}
                      </span>
                    </li>
                  );
                })}
              </ol>
            </Card>
          ) : null}

          <RoomMedia
            rooms={rooms.map((room) => ({
              id: room.id,
              name: room.name,
              description: room.description,
              // Vidéos effacées à l'échéance de conservation (pas celles retirées par le client avant l'envoi).
              purged: room.room_videos.filter((v) => v.deleted_at && v.uploaded_at && v.delete_after &&
                new Date(v.delete_after).getTime() - new Date(v.uploaded_at).getTime() > 86_400_000).length,
              videos: room.room_videos
                .filter((v) => !v.deleted_at && videoUrls.get(v.id))
                .sort((a, b) => a.created_at.localeCompare(b.created_at))
                .map((v) => ({
                  id: v.id,
                  url: videoUrls.get(v.id)!,
                  mimeType: v.mime_type,
                  size: v.size_bytes,
                  duration: v.duration_seconds,
                  width: v.width,
                  height: v.height,
                  processing: v.processing,
                  originalSize: v.original_size_bytes,
                  source: v.capture_source,
                  deleteAfter: v.delete_after,
                  frames: [...v.video_frames]
                    .sort((a, b) => (a.captured_at_ms ?? 0) - (b.captured_at_ms ?? 0))
                    .map((f) => ({ id: f.id, url: frameUrls.get(f.storage_path) ?? null, ms: f.captured_at_ms })),
                })),
            }))}
          />
        </div>

        <div className="flex min-w-0 flex-col gap-6">
          <Card as="section">
            <CardHeader title="Suivi" />
            <StatusForm id={request.id} status={request.status} />
            <p className="text-xs text-ink-muted">{STATUS_META[request.status].description}</p>
          </Card>

          <Card as="section">
            <CardHeader title="Devis" />
            {!pricing?.configured_at ? (
              <Alert tone="warning" title="Grille tarifaire non enregistrée">
                Aucune estimation n&apos;est calculée tant que vous n&apos;avez pas enregistré vos tarifs. <Link href="/espace/tarifs" className="font-medium text-brand underline">Configurer mes tarifs</Link>
              </Alert>
            ) : null}
            {quotes && quotes.length > 0 ? (
              <ul className="flex flex-col gap-2 text-sm">
                {quotes.map((q) => (
                  <li key={q.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-canvas px-3 py-2">
                    <span className="min-w-0">
                      <span className="flex flex-wrap items-center gap-1.5">
                        <span className="font-medium">V{q.version}</span>
                        <Badge tone={q.kind === "formal" ? "brand" : "warning"}>{q.kind === "formal" ? "Devis formel" : "Estimation indicative"}</Badge>
                        <Badge tone={QUOTE_STATUS_META[q.status]?.tone ?? "neutral"}>{QUOTE_STATUS_META[q.status]?.label ?? q.status}</Badge>
                      </span>
                      <span className="block text-xs text-ink-muted">{formatDateTime(q.created_at)}{q.origin === "automatic" ? " · calcul automatique" : q.origin === "correction" ? " · après vos corrections" : ""}</span>
                    </span>
                    <span className="font-semibold tabular-nums">{q.total_ttc_cents !== null ? formatEuros(q.total_ttc_cents) : "—"}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-ink-muted">Aucun devis calculé pour l&apos;instant.</p>
            )}
            {(() => {
              const latest = quotes?.find((q) => q.status !== "superseded");
              const reasons = Array.isArray(latest?.review_reasons) ? (latest.review_reasons as string[]) : [];
              return latest && latest.kind !== "formal" && reasons.length > 0 ? (
                <Alert tone="warning" title="Validation humaine nécessaire avant un devis formel">
                  <ul className="list-disc pl-5">{reasons.map((r, i) => <li key={i}>{r}</li>)}</ul>
                </Alert>
              ) : null;
            })()}
            {request.status !== "accepted" && pricing?.configured_at ? <QuoteActions requestId={request.id} canSend={items.length > 0} /> : null}
            {request.status === "accepted" ? <p className="text-sm text-success-text">Devis accepté par le client : il ne peut plus être remplacé.</p> : null}
          </Card>

          {run ? (
            <Card as="section">
              <CardHeader title="Analyse automatique" />
              {run.simulated ? <Alert tone="warning" title="Analyse simulée (environnement de test)">Ces résultats ne proviennent pas d&apos;une IA.</Alert> : null}
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
                <dt className="text-ink-muted">État</dt>
                <dd>{{ queued: "En attente", running: "En cours", succeeded: "Terminée", failed: "Échec" }[run.status]}{run.error_code ? ` (${{ not_configured: "analyse IA non configurée", missing_key: "clé API absente", missing_model: "modèle IA non choisi", simulation_forbidden: "simulation interdite ici", no_images: "aucune image", analysis_failed: "analyse impossible", internal_error: "erreur interne", save_failed: "enregistrement impossible" }[run.error_code] ?? run.error_code})` : ""}</dd>
                {run.model ? (<><dt className="text-ink-muted">Modèle</dt><dd>{run.model}</dd></>) : null}
                {run.rooms_total ? (<><dt className="text-ink-muted">Pièces</dt><dd>{run.rooms_done ?? 0} / {run.rooms_total} · {run.images_count} images</dd></>) : null}
                {run.input_tokens ? (<><dt className="text-ink-muted">Jetons</dt><dd className="tabular-nums">{run.input_tokens.toLocaleString("fr-FR")} en entrée · {(run.output_tokens ?? 0).toLocaleString("fr-FR")} en sortie</dd></>) : null}
                {run.cost_usd !== null && !run.simulated ? (<><dt className="text-ink-muted">Coût estimé</dt><dd className="tabular-nums">{formatCostUsd(Number(run.cost_usd))}</dd></>) : null}
              </dl>
              {run.error_message ? <p className="text-xs text-ink-muted">{run.error_message}</p> : null}
            </Card>
          ) : null}

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
