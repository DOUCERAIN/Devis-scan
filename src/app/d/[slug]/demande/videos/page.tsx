import { redirect } from "next/navigation";
import { stepHref } from "@/lib/public-request/steps";

/** Ancienne étape « une vidéo par pièce » (parcours v2) : remplacée par l'étape des médias du logement. */
export default async function VideosStep({ params }: PageProps<"/d/[slug]/demande/videos">) {
  const { slug } = await params;
  redirect(stepHref(slug, "medias"));
}
