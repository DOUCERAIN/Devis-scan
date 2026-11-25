import { redirect } from "next/navigation";
import { Stepper, StepTitle } from "@/components/customer/Stepper";
import { SubmitButton } from "@/components/forms/SubmitButton";
import { Alert } from "@/components/ui/Alert";
import { continueToVideos } from "../../actions";
import { stepHref } from "@/lib/public-request/steps";
import { requireDraft } from "../../load";
import { RoomsManager } from "./RoomsManager";

export default async function RoomsStep({ params }: PageProps<"/d/[slug]/demande/pieces">) {
  const { slug } = await params;
  const { draft, reachable } = await requireDraft(slug, 3);
  if (draft.inventory_method !== "video") redirect(stepHref(slug, "methode"));
  return (
    <>
      <Stepper slug={slug} current="inventaire" reachable={reachable} method={draft.inventory_method} />
      <StepTitle title="Vos pièces">Ajoutez chaque pièce contenant des meubles ou des cartons : vous filmerez chacune d&apos;elles à l&apos;étape suivante.</StepTitle>
      <RoomsManager slug={slug} rooms={draft.rooms} />
      {draft.rooms.length > 0 ? (
        <form action={continueToVideos}>
          <input type="hidden" name="slug" value={slug} />
          <SubmitButton size="lg" block pendingLabel="Chargement…">Continuer vers les vidéos</SubmitButton>
        </form>
      ) : (
        <Alert tone="info" title="Ajoutez au moins une pièce pour continuer." />
      )}
    </>
  );
}
