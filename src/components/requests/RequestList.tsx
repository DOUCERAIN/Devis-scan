import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { ChevronRight } from "lucide-react";
import { RequestStatusBadge } from "./RequestStatusBadge";
import { requestReference } from "@/lib/requests/status";
import { formatDate } from "@/lib/requests/labels";
import { formatVolume } from "@/lib/inventory/volume";
import type { RequestListItem } from "@/lib/data/requests";

function route(item: RequestListItem) {
  if (!item.origin_city && !item.destination_city) return "Trajet non précisé";
  return `${item.origin_city ?? "?"} → ${item.destination_city ?? "?"}`;
}

/** Liste des demandes : tableau sur ordinateur, liste sur mobile (charte : Table). */
export function RequestList({ items, prefix }: { items: RequestListItem[]; prefix: string }) {
  return (
    <>
      <ul className="overflow-hidden rounded-lg border border-border bg-surface md:hidden">
        {items.map((item) => (
          <li key={item.id} className="border-t border-border first:border-t-0">
            <Link href={`/espace/demandes/${item.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-canvas">
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-medium text-ink">{item.customer?.full_name ?? "Client sans nom"}</span>
                  <span className="flex shrink-0 items-center gap-1">
                    {item.is_test ? <SimulationBadge /> : null}
                    <RequestStatusBadge status={item.status} />
                  </span>
                </div>
                <span className="truncate text-[13px] text-ink-secondary">{route(item)}</span>
                <span className="text-xs text-ink-muted tabular-nums">
                  {requestReference(prefix, item.request_number)} · {formatDate(item.moving_date)}
                </span>
              </div>
              <ChevronRight aria-hidden className="size-4 shrink-0 text-ink-muted" />
            </Link>
          </li>
        ))}
      </ul>

      <div className="hidden overflow-x-auto rounded-lg border border-border bg-surface md:block">
        <table className="w-full border-collapse text-sm leading-5 tabular-nums">
          <thead>
            <tr className="text-left text-xs leading-4 font-semibold tracking-[0.06em] text-ink-secondary uppercase">
              <th className="border-b border-border px-4 py-3">Client</th>
              <th className="border-b border-border px-4 py-3">Trajet</th>
              <th className="border-b border-border px-4 py-3">Date souhaitée</th>
              <th className="border-b border-border px-4 py-3">Statut</th>
              <th className="border-b border-border px-4 py-3 text-right">Volume</th>
              <th className="border-b border-border px-4 py-3"><span className="sr-only">Ouvrir</span></th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="hover:bg-canvas">
                <td className="border-b border-border px-4 py-3">
                  <Link href={`/espace/demandes/${item.id}`} className="font-medium text-ink hover:text-brand">
                    {item.customer?.full_name ?? "Client sans nom"}
                  </Link>
                  <span className="block text-xs text-ink-muted">{requestReference(prefix, item.request_number)}</span>
                </td>
                <td className="border-b border-border px-4 py-3 text-ink-secondary">{route(item)}</td>
                <td className="border-b border-border px-4 py-3 text-ink-secondary">{formatDate(item.moving_date)}</td>
                <td className="border-b border-border px-4 py-3">
                  <span className="flex flex-wrap items-center gap-1">{item.is_test ? <SimulationBadge /> : null}<RequestStatusBadge status={item.status} /></span>
                </td>
                <td className="border-b border-border px-4 py-3 text-right text-ink">
                  {item.estimated_volume_m3 === null ? <span className="text-ink-muted">—</span> : formatVolume(Number(item.estimated_volume_m3))}
                </td>
                <td className="border-b border-border px-2 py-3 text-right">
                  <Link href={`/espace/demandes/${item.id}`} className="inline-grid size-8 place-items-center rounded-md text-ink-muted hover:bg-brand-soft hover:text-brand">
                    <ChevronRight aria-hidden className="size-4" />
                    <span className="sr-only">Ouvrir la demande</span>
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

/** Demande créée par « Nouvelle simulation » : conservée, exclue des compteurs. */
export function SimulationBadge() {
  return <Badge tone="warning">Simulation</Badge>;
}
