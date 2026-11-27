import Link from "next/link";
import { RestartButton } from "@/components/customer/NewRequestForms";
import { Stepper, StepTitle } from "@/components/customer/Stepper";
import { DraftSummary } from "@/components/customer/DraftSummary";
import { Alert } from "@/components/ui/Alert";
import { stepHref } from "@/lib/public-request/steps";
import { requireDraft } from "../../load";
import { SubmitForm } from "./SubmitForm";
import { OptionsForm, type OptionChoice } from "./OptionsForm";
import { getDraftOptions, getPublicOptions, readInventory } from "@/lib/public-request/service";

// Méthode vidéo : l'analyse s'exécute après l'envoi, dans la même fonction serveur.
export const maxDuration = 300;

export default async function SummaryStep({ params }: PageProps<"/d/[slug]/demande/recapitulatif">) {
  const { slug } = await params;
  const { draft, company, token, reachable } = await requireDraft(slug, 4);
  const manual = draft.inventory_method === "manual";
  const [options, selected, inventory] = await Promise.all([getPublicOptions(slug), getDraftOptions(token), manual ? readInventory(token) : null]);
  const withVideo = draft.rooms.filter((r) => r.videos.length > 0).length;
  // Pièces de l'ancien parcours restées sans vidéo (la pièce technique « Mon logement » n'en fait pas partie).
  const missing = draft.rooms.filter((r) => r.room_type !== "logement" && r.videos.length === 0).length;
  const canSubmit = manual ? (inventory?.items.length ?? 0) > 0 : withVideo > 0;
  return (
    <>
      <Stepper slug={slug} current="recapitulatif" reachable={reachable} method={draft.inventory_method} />
      <StepTitle title="Vérifiez votre demande">
        {manual ? "Vérifiez votre inventaire : votre devis est calculé dès l'envoi." : "Vous pouvez encore tout modifier avant l'envoi."}
      </StepTitle>
      {!manual && withVideo === 0 ? (
        <Alert tone="warning" title="Aucune vidéo ni photo pour le moment">
          Ajoutez au moins une vidéo ou une photo pour envoyer votre demande. <Link href={stepHref(slug, "medias")} className="font-medium text-brand underline">Ajouter mes vidéos ou photos</Link>
        </Alert>
      ) : !manual && missing > 0 ? (
        <Alert tone="warning" title={`${missing} pièce${missing > 1 ? "s" : ""} sans vidéo`}>
          Vous pouvez envoyer votre demande, mais une estimation est plus fiable quand chaque pièce est filmée.
        </Alert>
      ) : null}
      <DraftSummary slug={slug} draft={draft} editable inventory={inventory?.items} />
      {options.length > 0 ? (
        <OptionsForm slug={slug} options={options as OptionChoice[]} selected={selected} />
      ) : null}
      <SubmitForm slug={slug} notes={draft.customer_notes} canSubmit={canSubmit} companyName={company.name} manual={manual} />
      <RestartButton slug={slug} />
    </>
  );
}
