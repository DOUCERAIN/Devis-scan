import { Stepper, StepTitle } from "@/components/customer/Stepper";
import { requireDraft } from "../../load";
import { reachableStep } from "../reachable";
import { DwellingsForm } from "./DwellingsForm";

export default async function DwellingsStep({ params }: PageProps<"/d/[slug]/demande/logements">) {
  const { slug } = await params;
  const { draft } = await requireDraft(slug);
  return (
    <>
      <Stepper slug={slug} current="logements" reachable={reachableStep(draft)} />
      <StepTitle title="Vos logements">Ces informations permettent d&apos;organiser le chargement et le déchargement.</StepTitle>
      <DwellingsForm slug={slug} draft={draft} />
    </>
  );
}
