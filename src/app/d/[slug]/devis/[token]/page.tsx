import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Link2 } from "lucide-react";
import { getQuoteView } from "@/lib/public-request/service";
import { FollowUp, analysisPending } from "@/components/quote/FollowUp";
import { loadContext } from "../../load";
import { AutoRefresh } from "./AutoRefresh";
import { RespondForm } from "./RespondForm";

export const metadata: Metadata = { referrer: "no-referrer", robots: { index: false, follow: false } };

/**
 * Suivi et devis du particulier, accessibles par un lien secret (jeton de consultation de 64 caractères,
 * seul son hachage est en base). Le lien ne contient aucun identifiant de demande.
 */
export default async function QuotePage({ params }: PageProps<"/d/[slug]/devis/[token]">) {
  const { slug, token } = await params;
  const { company } = await loadContext(slug);
  const view = await getQuoteView(token);
  if (!view) notFound();
  const pending = analysisPending(view);
  const hasQuote = view.quotes.some((q) => q.status !== "superseded");
  return (
    <>
      <AutoRefresh active={pending} />
      <header className="flex flex-col gap-2">
        <h1 className="text-[26px] leading-[34px] font-bold">Votre demande de devis</h1>
        <p className="flex gap-2 rounded-md bg-brand-soft p-3 text-sm">
          <Link2 aria-hidden className="mt-0.5 size-4 shrink-0 text-brand" />
          <span>Conservez l&apos;adresse de cette page (favori ou capture) : elle vous permet de revenir à votre devis. Ne la partagez pas.</span>
        </p>
      </header>
      <FollowUp
        view={view}
        companyName={company.name}
        pdfHref={hasQuote && !pending ? `/d/${slug}/devis/${token}/pdf` : null}
        respond={(quoteId) => <RespondForm slug={slug} token={token} quoteId={quoteId} />}
      />
    </>
  );
}
