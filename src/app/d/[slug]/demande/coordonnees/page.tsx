import { Stepper, StepTitle } from "@/components/customer/Stepper";
import { requireDraft } from "../../load";
import { ContactForm } from "./ContactForm";

export default async function ContactStep({ params }: PageProps<"/d/[slug]/demande/coordonnees">) {
  const { slug } = await params;
  const { draft, company, reachable } = await requireDraft(slug, 1);
  return (
    <>
      <Stepper slug={slug} current="coordonnees" reachable={reachable} method={draft.inventory_method} />
      <StepTitle title="Vos coordonnées">Pour vous transmettre votre devis et organiser votre déménagement.</StepTitle>
      <ContactForm slug={slug} companyName={company.name} customer={draft.customer} />
    </>
  );
}
