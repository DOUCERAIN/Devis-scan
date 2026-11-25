import { getQuoteView } from "@/lib/public-request/service";
import { renderQuotePdf } from "@/lib/quotes/pdf";
import { toPdfQuote } from "@/lib/quotes/pdf-data";
import { customerQuoteState } from "@/lib/quotes/customer-state";

/** PDF du devis (lien secret ; jamais mis en cache public). */
export async function GET(request: Request, ctx: RouteContext<"/d/[slug]/devis/[token]/pdf">) {
  const { token } = await ctx.params;
  const view = await getQuoteView(token);
  // ?version=N : une version précise (comparaison avec l'avenant ou la nouvelle version) ; sinon la version à afficher.
  const asked = Number(new URL(request.url).searchParams.get("version"));
  const quote = view ? (Number.isInteger(asked) && asked > 0 ? view.quotes.find((q) => q.version === asked) : customerQuoteState(view.quotes).current) : undefined;
  if (!view || !quote) return new Response("Devis introuvable", { status: 404 });
  const bytes = await renderQuotePdf(toPdfQuote(quote));
  return new Response(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="devis-${quote.request.reference}-v${quote.version}.pdf"`,
      "Cache-Control": "private, no-store",
      "Referrer-Policy": "no-referrer",
      "X-Robots-Tag": "noindex",
    },
  });
}
