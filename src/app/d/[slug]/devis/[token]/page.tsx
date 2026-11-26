import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Link2 } from "lucide-react";
import { Alert } from "@/components/ui/Alert";
import { getCustomerCatalog, getPublicInventory, getQuoteView, type PublicInventoryItem } from "@/lib/public-request/service";
import { ResumeManualForm } from "./ResumeManualForm";
import { customerDuplicateExplanation } from "@/lib/inventory/duplicates";
import type { ReviewDuplicate } from "./InventoryReview";
import { ReviewInventory } from "./ReviewInventory";
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

  // Inventaire à valider par le client avant son devis final.
  let review: { items: PublicInventoryItem[]; rooms: { id: string; name: string; category: string | null }[]; extraBoxes: number | null; duplicates: ReviewDuplicate[] } | null = null;
  if (view.status === "awaiting_customer" && !pending) {
    const data = await getPublicInventory(token);
    if (data) {
      const { inventory, imageUrls } = data;
      review = {
        items: inventory.items,
        rooms: inventory.rooms,
        extraBoxes: inventory.extra_boxes,
        duplicates: inventory.items
          .filter((i) => i.possible_duplicate)
          .map((i) => ({
            id: i.id, name: i.name, room: i.room, quantity: i.quantity,
            explanation: customerDuplicateExplanation({ name: i.name, room: i.room, duplicateOf: i.duplicate_of, reason: i.duplicate_reason }),
            images: i.frames.map((f) => imageUrls.get(f)).filter((u): u is string => Boolean(u)),
            otherImages: i.duplicate_frames.map((f) => imageUrls.get(f)).filter((u): u is string => Boolean(u)),
            otherLabel: i.duplicate_of ? `« ${i.duplicate_of.name} » (${i.duplicate_of.room})` : null,
          })),
      };
    }
  }
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
      {review && view.analysis?.simulated ? (
        <Alert tone="warning" title="Environnement de test">Inventaire produit par le simulateur de test, et non par une analyse réelle des vidéos.</Alert>
      ) : null}
      {review ? (
        <>
          <p className="text-sm text-ink-secondary">
            {review.items.some((i) => i.source === "ai")
              ? "Voici les meubles et objets repérés dans vos vidéos et photos, rangés par pièce. Indiquez d'abord vos cartons supplémentaires, puis corrigez les quantités, retirez ce qui ne déménage pas et ajoutez ce qui manque. Validez ensuite pour recevoir votre devis."
              : "Indiquez vos cartons, puis ajoutez vos meubles et objets pièce par pièce, et validez pour recevoir votre devis."}
          </p>
          <ReviewInventory slug={slug} token={token} catalog={await getCustomerCatalog()} duplicates={review.duplicates}
            initial={{ rooms: review.rooms, items: review.items, extra_boxes: review.extraBoxes }} />
        </>
      ) : (
      <FollowUp
        view={view}
        companyName={company.name}
        pdfHref={hasQuote && !pending ? `/d/${slug}/devis/${token}/pdf` : null}
        respond={(quoteId, label) => <RespondForm slug={slug} token={token} quoteId={quoteId} label={label} />}
        versionPdfHref={(version) => `/d/${slug}/devis/${token}/pdf?version=${version}`}
        resumeManually={view.status === "to_review" && !hasQuote ? <ResumeManualForm slug={slug} token={token} /> : undefined}
      />
      )}
    </>
  );
}
