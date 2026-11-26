import { redirect } from "next/navigation";
import { Stepper, StepTitle } from "@/components/customer/Stepper";
import { publicEnv } from "@/lib/env";
import { stepHref } from "@/lib/public-request/steps";
import { requireDraft } from "../../load";
import { MediaStep } from "./MediaStep";

/** Méthode « vidéo » (parcours v3) : vidéos et photos du logement, sans pièce à déclarer. */
export default async function MediaPage({ params }: PageProps<"/d/[slug]/demande/medias">) {
  const { slug } = await params;
  const { draft, reachable } = await requireDraft(slug, 3);
  if (draft.inventory_method !== "video") redirect(stepHref(slug, "methode"));
  const env = publicEnv();
  // Tous les médias déjà envoyés, y compris ceux d'un brouillon commencé avec l'ancien parcours (une vidéo par pièce).
  const existing = draft.rooms.flatMap((r) => r.videos);
  return (
    <>
      <Stepper slug={slug} current="inventaire" reachable={reachable} method={draft.inventory_method} />
      <StepTitle title="Montrez-nous votre logement">
        Filmez, importez vos vidéos ou vos photos. Les vidéos sont compressées sur votre appareil puis envoyées de façon sécurisée ; nous en tirons votre inventaire.
      </StepTitle>
      <MediaStep slug={slug} existing={existing} config={{ supabaseUrl: env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/, ""), publishableKey: env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY }} />
    </>
  );
}
