"use client";

import { VisualInventory } from "@/components/customer/VisualInventory";
import type { InventorySnapshot } from "@/app/d/[slug]/inventory-actions";
import type { CatalogChoice } from "@/lib/inventory/manual";
import { InventoryReview, type ReviewDuplicate } from "./InventoryReview";

/**
 * Inventaire de l'analyse à corriger puis valider par le client : inventaire visuel, puis « Éléments à
 * vérifier » (seulement les objets encore présents) et validation, une fois tout enregistré.
 */
export function ReviewInventory({ slug, token, catalog, initial, duplicates }: {
  slug: string; token: string; catalog: CatalogChoice[]; initial: InventorySnapshot; duplicates: ReviewDuplicate[];
}) {
  return (
    <VisualInventory slug={slug} viewToken={token} catalog={catalog} initial={initial} footer={({ boxesAnswered, itemCount, liveIds, flush }) => (
      <InventoryReview slug={slug} token={token} duplicates={duplicates.filter((d) => liveIds.has(d.id))} empty={itemCount === 0}
        blocked={boxesAnswered ? null : "Indiquez d'abord le nombre de cartons supplémentaires, en haut de l'inventaire."} beforeSubmit={flush} />
    )} />
  );
}
