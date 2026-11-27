import { Alert } from "@/components/ui/Alert";
import { Stepper, StepTitle } from "@/components/customer/Stepper";
import { loadContext } from "../../load";
import { reachableStep } from "../reachable";
import { TripForm } from "./TripForm";
import { RestartButton } from "@/components/customer/NewRequestForms";

export default async function TripStep({ params, searchParams }: PageProps<"/d/[slug]/demande/trajet">) {
  const { slug } = await params;
  const { session } = await searchParams;
  // Sans demande en cours : formulaire vierge = nouvelle demande (une demande envoyée ne bloque jamais).
  const { draft, expired } = await loadContext(slug);
  return (
    <>
      <Stepper slug={slug} current="trajet" reachable={reachableStep(draft)} method={draft?.inventory_method} />
      <StepTitle title="Votre déménagement">D&apos;où partez-vous, où allez-vous et quand ? Ces informations servent à calculer votre devis.</StepTitle>
      {(expired || session === "expiree") && (
        <Alert tone="warning" title="Votre session a expiré">Votre précédente demande n&apos;est plus accessible. Vous pouvez en commencer une nouvelle ci-dessous.</Alert>
      )}
      {/* Clé : une nouvelle demande repart toujours d'un formulaire neuf (aucune saisie précédente conservée à l'écran). */}
      <TripForm key={draft?.id ?? "nouvelle-demande"} slug={slug} draft={draft} />
      {draft ? <RestartButton slug={slug} /> : null}
    </>
  );
}
