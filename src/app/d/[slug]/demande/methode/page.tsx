import { Stepper, StepTitle } from "@/components/customer/Stepper";
import { requireDraft } from "../../load";
import { MethodForm } from "./MethodForm";

export default async function MethodStep({ params }: PageProps<"/d/[slug]/demande/methode">) {
  const { slug } = await params;
  const { draft, reachable } = await requireDraft(slug, 2);
  const hasVideos = draft.rooms.some((r) => r.videos.length > 0);
  return (
    <>
      <Stepper slug={slug} current="methode" reachable={reachable} method={draft.inventory_method} />
      <StepTitle title="Votre inventaire">Comment souhaitez-vous indiquer vos meubles et objets ?</StepTitle>
      <MethodForm slug={slug} current={draft.inventory_method} hasVideos={hasVideos} hasItems={draft.item_count > 0} />
    </>
  );
}
