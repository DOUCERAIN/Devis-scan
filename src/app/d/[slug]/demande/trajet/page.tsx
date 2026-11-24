import { redirect } from "next/navigation";
import { Alert } from "@/components/ui/Alert";
import { Stepper, StepTitle } from "@/components/customer/Stepper";
import { stepHref } from "@/lib/public-request/steps";
import { loadContext } from "../../load";
import { reachableStep } from "../reachable";
import { TripForm } from "./TripForm";

export default async function TripStep({ params, searchParams }: PageProps<"/d/[slug]/demande/trajet">) {
  const { slug } = await params;
  const { session } = await searchParams;
  const { company, draft, expired } = await loadContext(slug);
  if (draft && draft.status !== "draft") redirect(stepHref(slug, "envoyee"));
  return (
    <>
      <Stepper slug={slug} current="trajet" reachable={reachableStep(draft)} />
      <StepTitle title="Votre déménagement">D&apos;où partez-vous, où allez-vous et quand ?</StepTitle>
      {(expired || session === "expiree") && (
        <Alert tone="warning" title="Votre session a expiré">Votre précédente demande n&apos;est plus accessible. Vous pouvez en commencer une nouvelle ci-dessous.</Alert>
      )}
      <TripForm slug={slug} companyName={company.name} draft={draft} />
    </>
  );
}
