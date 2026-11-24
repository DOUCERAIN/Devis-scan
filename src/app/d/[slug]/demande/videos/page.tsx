import { redirect } from "next/navigation";
import { Stepper, StepTitle } from "@/components/customer/Stepper";
import { publicEnv } from "@/lib/env";
import { stepHref } from "@/lib/public-request/steps";
import { requireDraft } from "../../load";
import { reachableStep } from "../reachable";
import { VideoStep } from "./VideoStep";

export default async function VideosStep({ params }: PageProps<"/d/[slug]/demande/videos">) {
  const { slug } = await params;
  const { draft } = await requireDraft(slug);
  if (draft.rooms.length === 0) redirect(stepHref(slug, "pieces"));
  const env = publicEnv();
  return (
    <>
      <Stepper slug={slug} current="videos" reachable={reachableStep(draft)} />
      <StepTitle title="Filmez vos pièces">Une courte vidéo par pièce. Elle est compressée sur votre téléphone puis envoyée de façon sécurisée.</StepTitle>
      <VideoStep
        slug={slug}
        rooms={draft.rooms}
        config={{ supabaseUrl: env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/, ""), publishableKey: env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY }}
      />
    </>
  );
}
