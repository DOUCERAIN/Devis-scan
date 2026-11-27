import { redirect } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { DraftSummary } from "@/components/customer/DraftSummary";
import { formatDate } from "@/lib/requests/labels";
import { stepHref } from "@/lib/public-request/steps";
import { loadContext } from "../../load";
import { getQuoteView } from "@/lib/public-request/service";
import { FollowUp, analysisPending } from "@/components/quote/FollowUp";
import { AutoRefresh } from "../../devis/[token]/AutoRefresh";
import { ButtonLink } from "@/components/ui/Button";
import { NewRequestButton, SimulationButton } from "@/components/customer/NewRequestForms";
import { testToolsEnabled } from "@/lib/public-request/test-tools";

export default async function SentPage({ params }: PageProps<"/d/[slug]/demande/envoyee">) {
  const { slug } = await params;
  // Dernière demande envoyée depuis cet appareil (lecture seule). Une nouvelle demande éventuellement
  // commencée depuis reste à part et se reprend depuis l'accueil.
  const { company, lastSent: draft, lastSentToken: token, draft: current } = await loadContext(slug);
  if (!draft) redirect(current ? stepHref(slug, "recapitulatif") : `/d/${slug}`);
  const view = token ? await getQuoteView(token) : null;
  const testTools = await testToolsEnabled(company.id);
  return (
    <>
      {view ? <AutoRefresh active={analysisPending(view)} /> : null}
      <section className="flex flex-col items-center gap-3 rounded-lg border border-border bg-surface px-5 py-8 text-center">
        <span aria-hidden className="grid size-14 place-items-center rounded-full bg-success-soft text-success"><CheckCircle2 className="size-8" /></span>
        <h1 className="text-[26px] leading-[34px] font-bold">Demande envoyée</h1>
        <p className="max-w-[46ch] text-ink-secondary">
          Merci {draft.customer?.full_name?.split(" ")[0]}. {company.name} a bien reçu votre demande
          {draft.submitted_at ? ` le ${formatDate(draft.submitted_at)}` : ""} et reviendra vers vous à l&apos;adresse {draft.customer?.email}.
        </p>
        <p className="text-sm text-ink-muted">Votre demande ne peut plus être modifiée. Pour toute précision, contactez directement {company.name}.</p>
        <div className="mt-2 flex w-full max-w-sm flex-col gap-3">
          {current ? (
            <ButtonLink href={stepHref(slug, "trajet")} size="lg" block>Reprendre ma nouvelle demande en cours</ButtonLink>
          ) : (
            <NewRequestButton slug={slug} />
          )}
          {testTools ? <SimulationButton slug={slug} /> : null}
        </div>
      </section>
      {view ? <FollowUp view={view} companyName={company.name} pdfHref={null} /> : null}
      <DraftSummary slug={slug} draft={draft} editable={false} />
    </>
  );
}
