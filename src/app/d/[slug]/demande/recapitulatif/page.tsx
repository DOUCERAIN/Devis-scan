import Link from "next/link";
import { Stepper, StepTitle } from "@/components/customer/Stepper";
import { DraftSummary } from "@/components/customer/DraftSummary";
import { Alert } from "@/components/ui/Alert";
import { stepHref } from "@/lib/public-request/steps";
import { requireDraft } from "../../load";
import { reachableStep } from "../reachable";
import { SubmitForm } from "./SubmitForm";

export default async function SummaryStep({ params }: PageProps<"/d/[slug]/demande/recapitulatif">) {
  const { slug } = await params;
  const { draft, company } = await requireDraft(slug);
  const withVideo = draft.rooms.filter((r) => r.videos.length > 0).length;
  const missing = draft.rooms.length - withVideo;
  return (
    <>
      <Stepper slug={slug} current="recapitulatif" reachable={reachableStep(draft)} />
      <StepTitle title="Vérifiez votre demande">Vous pouvez encore tout modifier avant l&apos;envoi.</StepTitle>
      {withVideo === 0 ? (
        <Alert tone="warning" title="Aucune vidéo pour le moment">
          Ajoutez au moins une vidéo pour envoyer votre demande. <Link href={stepHref(slug, "videos")} className="font-medium text-brand underline">Filmer mes pièces</Link>
        </Alert>
      ) : missing > 0 ? (
        <Alert tone="warning" title={`${missing} pièce${missing > 1 ? "s" : ""} sans vidéo`}>
          Vous pouvez envoyer votre demande, mais une estimation est plus fiable quand chaque pièce est filmée.
        </Alert>
      ) : null}
      <DraftSummary slug={slug} draft={draft} editable />
      <SubmitForm slug={slug} notes={draft.customer_notes} canSubmit={withVideo > 0} companyName={company.name} />
    </>
  );
}
