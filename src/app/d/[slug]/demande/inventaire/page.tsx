import { redirect } from "next/navigation";
import { Stepper, StepTitle } from "@/components/customer/Stepper";
import { getCustomerCatalog, readInventory } from "@/lib/public-request/service";
import { stepHref } from "@/lib/public-request/steps";
import { requireDraft } from "../../load";
import { ManualInventory } from "./ManualInventory";

export default async function ManualInventoryStep({ params }: PageProps<"/d/[slug]/demande/inventaire">) {
  const { slug } = await params;
  const { draft, token, reachable } = await requireDraft(slug, 3);
  if (draft.inventory_method !== "manual") redirect(stepHref(slug, "inventaire", draft.inventory_method ?? undefined));
  const [catalog, inventory] = await Promise.all([getCustomerCatalog(), readInventory(token)]);
  return (
    <>
      <Stepper slug={slug} current="inventaire" reachable={reachable} method="manual" />
      <StepTitle title="Votre inventaire">Vos cartons d&apos;abord, puis vos meubles pièce par pièce : touchez un meuble sur l&apos;illustration pour l&apos;ajouter. Tout est enregistré au fur et à mesure.</StepTitle>
      <ManualInventory slug={slug} catalog={catalog} initial={{ rooms: inventory?.rooms ?? [], items: inventory?.items ?? [], extra_boxes: inventory?.extra_boxes ?? null }} />
    </>
  );
}
