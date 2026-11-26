"use client";

import { useTransition } from "react";
import { VisualInventory } from "@/components/customer/VisualInventory";
import type { InventorySnapshot } from "@/app/d/[slug]/inventory-actions";
import type { CatalogChoice } from "@/lib/inventory/manual";
import { Button } from "@/components/ui/Button";
import { continueToSummary } from "../../actions";

/** Inventaire manuel (brouillon) : inventaire visuel puis passage au récapitulatif, une fois tout enregistré. */
export function ManualInventory({ slug, catalog, initial }: { slug: string; catalog: CatalogChoice[]; initial: InventorySnapshot }) {
  const [waiting, startTransition] = useTransition();
  return (
    <VisualInventory slug={slug} catalog={catalog} initial={initial} footer={({ saving, boxesAnswered, itemCount, flush }) => {
      const blocked = !boxesAnswered ? "Indiquez d'abord le nombre de cartons supplémentaires." : itemCount === 0 ? "Ajoutez au moins un meuble, un objet ou un carton." : null;
      return (
        <form action={continueToSummary} className="flex flex-col gap-2" onSubmit={(e) => {
          if (!saving) return;
          // Enregistrement en cours : on attend la fin avant de passer au récapitulatif.
          e.preventDefault();
          const data = new FormData(e.currentTarget);
          startTransition(async () => {
            await flush();
            await continueToSummary(data);
          });
        }}>
          <input type="hidden" name="slug" value={slug} />
          <Button type="submit" size="lg" block disabled={Boolean(blocked) || waiting} data-testid="inventory-continue">{waiting ? "Enregistrement…" : "Vérifier et continuer"}</Button>
          {blocked ? <p className="text-sm text-ink-secondary">{blocked}</p> : saving ? <p className="text-sm text-ink-muted">Enregistrement en cours…</p> : null}
        </form>
      );
    }} />
  );
}
