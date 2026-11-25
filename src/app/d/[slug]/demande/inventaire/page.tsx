import { redirect } from "next/navigation";
import { Stepper, StepTitle } from "@/components/customer/Stepper";
import { InventoryBuilder } from "@/components/customer/InventoryBuilder";
import { SubmitButton } from "@/components/forms/SubmitButton";
import { getCustomerCatalog, readInventory } from "@/lib/public-request/service";
import { stepHref } from "@/lib/public-request/steps";
import { continueToSummary } from "../../actions";
import { requireDraft } from "../../load";

export default async function ManualInventoryStep({ params }: PageProps<"/d/[slug]/demande/inventaire">) {
  const { slug } = await params;
  const { draft, token, reachable } = await requireDraft(slug, 3);
  if (draft.inventory_method !== "manual") redirect(stepHref(slug, "inventaire", draft.inventory_method ?? undefined));
  const [catalog, inventory] = await Promise.all([getCustomerCatalog(), readInventory(token)]);
  const items = inventory?.items ?? [];
  return (
    <>
      <Stepper slug={slug} current="inventaire" reachable={reachable} method="manual" />
      <StepTitle title="Votre inventaire">Ajoutez vos meubles, appareils et cartons pièce par pièce. Tout est enregistré au fur et à mesure.</StepTitle>
      <InventoryBuilder slug={slug} catalog={catalog} items={items} />
      {items.length > 0 ? (
        <form action={continueToSummary} className="sticky bottom-0 -mx-4 border-t border-border bg-surface/95 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0">
          <input type="hidden" name="slug" value={slug} />
          <SubmitButton size="lg" block pendingLabel="Chargement…">Vérifier et continuer</SubmitButton>
        </form>
      ) : null}
    </>
  );
}
