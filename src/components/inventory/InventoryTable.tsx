import { Pencil } from "lucide-react";
import { ConfidenceBadge } from "@/components/ui/ConfidenceBadge";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/components/ui/cn";
import { formatVolume, volumeBucket, type InventoryItem } from "@/lib/inventory/volume";
import { confidenceLevel } from "@/lib/inventory/confidence";

/** Inventaire côté déménageur (charte : Table). Lecture seule pour l'instant. */
export function InventoryTable({ items }: { items: readonly InventoryItem[] }) {
  return (
    <>
    <InventoryList items={items} />
    <div className="hidden overflow-x-auto rounded-lg border border-border bg-surface md:block">
      <table className="w-full border-collapse text-sm leading-5 tabular-nums">
        <thead>
          <tr className="text-left text-xs leading-4 font-semibold tracking-[0.06em] text-ink-secondary uppercase">
            <th className="border-b border-border px-4 py-3">Élément</th>
            <th className="border-b border-border px-4 py-3">Qté</th>
            <th className="border-b border-border px-4 py-3">Confiance</th>
            <th className="border-b border-border px-4 py-3 text-right">Volume</th>
            <th className="border-b border-border px-4 py-3"><span className="sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const bucket = volumeBucket(item);
            const level = item.confidence === undefined ? null : confidenceLevel(item.confidence);
            const stripe = item.possibleDuplicate
              ? "shadow-[inset_3px_0_0_var(--ds-duplicate)]"
              : level === "uncertain"
                ? "shadow-[inset_3px_0_0_var(--ds-danger)]"
                : level === "verify"
                  ? "shadow-[inset_3px_0_0_var(--ds-warning)]"
                  : "";
            const volume = item.quantity * item.unitVolumeM3;
            return (
              <tr key={item.id} className="hover:bg-canvas">
                <td className={cn("border-b border-border px-4 py-3 text-ink", stripe)}>
                  {item.name}
                  <span className="block text-xs leading-4 text-ink-muted">{item.room}</span>
                </td>
                <td className="border-b border-border px-4 py-3">{item.quantity}</td>
                <td className="border-b border-border px-4 py-3">
                  {item.source === "manual" ? (
                    <Badge tone="neutral">Saisi à la main</Badge>
                  ) : (
                    <ConfidenceBadge audience="pro" score={item.confidence ?? 0} possibleDuplicate={item.possibleDuplicate} />
                  )}
                </td>
                <td className="border-b border-border px-4 py-3 text-right whitespace-nowrap">
                  {bucket === "potential" ? <span className="text-ink-muted">non compté</span> : formatVolume(volume)}
                </td>
                <td className="border-b border-border px-2 py-3 text-right">
                  <button type="button" disabled title="Modification disponible dans une prochaine étape" className="inline-grid size-8 place-items-center rounded-md text-ink-disabled">
                    <Pencil aria-hidden className="size-4" />
                    <span className="sr-only">Modifier (bientôt disponible)</span>
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
    </>
  );
}

/** Version liste pour les écrans étroits (charte : InventoryItem). */
function InventoryList({ items }: { items: readonly InventoryItem[] }) {
  return (
    <ul className="overflow-hidden rounded-lg border border-border bg-surface md:hidden">
      {items.map((item) => {
        const potential = volumeBucket(item) === "potential";
        return (
          <li key={item.id} className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 border-t border-border px-4 py-3 first:border-t-0">
            <span className="text-[15px] leading-[22px] font-medium text-ink">
              {item.quantity > 1 ? `${item.quantity} × ` : ""}{item.name}
            </span>
            <span className="text-right text-sm font-semibold tabular-nums text-ink">
              {potential ? <span className="font-normal text-ink-muted">non compté</span> : formatVolume(item.quantity * item.unitVolumeM3)}
            </span>
            <span className="text-xs leading-4 text-ink-muted">{item.room}</span>
            <span className="justify-self-end">
              {item.source === "manual" ? (
                <Badge tone="neutral">Saisi à la main</Badge>
              ) : (
                <ConfidenceBadge audience="pro" score={item.confidence ?? 0} possibleDuplicate={item.possibleDuplicate} />
              )}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
