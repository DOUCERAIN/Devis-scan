import { redirect } from "next/navigation";
import { stepHref } from "@/lib/public-request/steps";

/** Ancienne étape « Vos logements », désormais regroupée avec l'étape « Déménagement ». */
export default async function DwellingsStep({ params }: PageProps<"/d/[slug]/demande/logements">) {
  const { slug } = await params;
  redirect(stepHref(slug, "trajet"));
}
