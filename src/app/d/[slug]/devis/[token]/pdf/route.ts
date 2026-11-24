import { getQuoteView } from "@/lib/public-request/service";
import { renderQuotePdf } from "@/lib/quotes/pdf";
import { toPdfQuote } from "@/lib/quotes/pdf-data";

/** PDF de la version courante du devis (lien secret ; jamais mis en cache public). */
export async function GET(_request: Request, ctx: RouteContext<"/d/[slug]/devis/[token]/pdf">) {
  const { token } = await ctx.params;
  const view = await getQuoteView(token);
  const quote = view?.quotes.find((q) => q.status !== "superseded");
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
