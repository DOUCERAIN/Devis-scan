import { redirect } from "next/navigation";
import { stepHref } from "@/lib/public-request/steps";

/** Ancienne étape « Vos pièces » (parcours v2) : le client ne déclare plus de pièce avant de filmer. */
export default async function RoomsStep({ params }: PageProps<"/d/[slug]/demande/pieces">) {
  const { slug } = await params;
  redirect(stepHref(slug, "medias"));
}
