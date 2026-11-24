import { Stepper, StepTitle } from "@/components/customer/Stepper";
import { SubmitButton } from "@/components/forms/SubmitButton";
import { Alert } from "@/components/ui/Alert";
import { continueToVideos } from "../../actions";
import { requireDraft } from "../../load";
import { reachableStep } from "../reachable";
import { RoomsManager } from "./RoomsManager";

export default async function RoomsStep({ params }: PageProps<"/d/[slug]/demande/pieces">) {
  const { slug } = await params;
  const { draft } = await requireDraft(slug);
  return (
    <>
      <Stepper slug={slug} current="pieces" reachable={reachableStep(draft)} />
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
