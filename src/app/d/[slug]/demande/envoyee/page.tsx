import { redirect } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { DraftSummary } from "@/components/customer/DraftSummary";
import { formatDate } from "@/lib/requests/labels";
import { stepHref } from "@/lib/public-request/steps";
import { loadContext } from "../../load";
import { getQuoteView } from "@/lib/public-request/service";
import { FollowUp, analysisPending } from "@/components/quote/FollowUp";
import { AutoRefresh } from "../../devis/[token]/AutoRefresh";

export default async function SentPage({ params }: PageProps<"/d/[slug]/demande/envoyee">) {
  const { slug } = await params;
  const { company, draft, token } = await loadContext(slug);
  if (!draft) redirect(`/d/${slug}`);
  if (draft.status === "draft") redirect(stepHref(slug, "recapitulatif"));
  const view = token ? await getQuoteView(token) : null;
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
      </section>
      {view ? <FollowUp view={view} companyName={company.name} pdfHref={null} /> : null}
      <DraftSummary slug={slug} draft={draft} editable={false} />
    </>
  );
}
