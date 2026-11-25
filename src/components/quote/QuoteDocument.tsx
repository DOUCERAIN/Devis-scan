import { AlertTriangle, Info } from "lucide-react";
import type { PublicQuote } from "@/lib/public-request/service";
import { formatEuros } from "@/lib/pricing/engine";
import { formatVolume } from "@/lib/inventory/volume";
import { formatDate } from "@/lib/requests/labels";

const LEVEL_LABEL: Record<string, { label: string; className: string }> = {
  human: { label: "Confirmé", className: "text-success-text" },
  sure: { label: "Sûr", className: "text-success-text" },
  verify: { label: "À vérifier", className: "text-warning-text" },
  uncertain: { label: "Incertain", className: "text-danger-text" },
};

const ELEVATOR: Record<string, string> = { none: "sans ascenseur", small: "petit ascenseur", standard: "ascenseur", large: "grand ascenseur" };

function Address({ title, d }: { title: string; d: Record<string, unknown> | null }) {
  if (!d) return null;
  const floor = typeof d.floor === "number" ? (d.floor === 0 ? "rez-de-chaussée" : `${d.floor}e étage`) : null;
  return (
    <div className="min-w-0">
      <p className="text-xs font-semibold tracking-wide text-ink-muted uppercase">{title}</p>
      <p className="text-sm">{[d.address_line, [d.postal_code, d.city].filter(Boolean).join(" ")].filter(Boolean).join(", ") || "Adresse non précisée"}</p>
      <p className="text-sm text-ink-secondary">{[floor, typeof d.elevator === "string" ? ELEVATOR[d.elevator] : null].filter(Boolean).join(", ")}</p>
    </div>
  );
}

export function quoteKindLabel(q: Pick<PublicQuote, "kind" | "status">) {
  if (q.kind === "formal" && ["sent", "accepted", "refused", "expired"].includes(q.status)) return "Devis";
  return "Estimation indicative";
}

/**
 * Devis ou estimation, tel que figé dans ses instantanés (une modification ultérieure de la
 * grille tarifaire ou de l'entreprise ne change pas un document déjà établi).
 * audience « customer » : libellés de confiance seuls (jamais de pourcentage).
 */
export function QuoteDocument({ quote, audience }: { quote: PublicQuote; audience: "customer" | "pro" }) {
  const c = quote.company;
  const v = quote.volume;
  const rooms = new Map<string, PublicQuote["inventory"]>();
  for (const item of quote.inventory) rooms.set(item.room, [...(rooms.get(item.room) ?? []), item]);
  const isEstimate = quoteKindLabel(quote) !== "Devis";
  // Motifs de validation : côté client, seuls ceux qui concernent sa demande (pas les réglages internes).
  const reasons = (quote.review_reasons ?? []).filter(
    (r) => (audience === "pro" || !/Envoi automatique|Identité légale|Grille tarifaire|simulateur/.test(r)) && !quote.assumptions.includes(r),
  );
  const address = [c.address_line1, c.address_line2, [c.postal_code, c.city].filter(Boolean).join(" ")].filter(Boolean).join(", ");

  return (
    <article className="flex flex-col gap-5 rounded-lg border border-border bg-surface p-4 sm:p-6">
      <header className="flex flex-col gap-1">
        <p className="flex flex-wrap items-center gap-2">
          <span
            data-testid="quote-kind"
            className={
              isEstimate
                ? "rounded-full bg-warning-soft px-2.5 py-0.5 text-xs font-semibold text-warning-text"
                : "rounded-full bg-brand px-2.5 py-0.5 text-xs font-semibold text-on-brand"
            }
          >
            {isEstimate ? "Estimation indicative · non contractuelle" : "Devis"}
          </span>
          <span className="text-xs font-semibold tracking-wide text-ink-muted uppercase">
            n° {quote.request.reference}-V{quote.version}
          </span>
        </p>
        <h2 className="font-display text-xl font-bold">{String(c.legal_name ?? c.name)}</h2>
        <p className="text-sm text-ink-secondary">
          {[address, c.siret ? `SIRET ${c.siret}` : null, c.vat_number ? `TVA ${c.vat_number}` : null].filter(Boolean).join(" · ")}
        </p>
        <p className="text-sm text-ink-secondary">
          Établi le {formatDate(quote.created_at)}
          {quote.valid_until ? ` · valable jusqu'au ${formatDate(quote.valid_until)}` : ""}
        </p>
      </header>

      {isEstimate ? (
        <div className="flex gap-2 rounded-md border border-warning/40 bg-warning-soft p-3 text-sm">
          <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0 text-warning" />
          <div className="flex flex-col gap-1">
            <p>
              Estimation calculée {quote.origin === "automatic" ? "automatiquement à partir de vos vidéos" : "par votre déménageur"} et des tarifs de{" "}
              {String(c.name)}. Elle n&apos;engage pas encore l&apos;entreprise : {String(c.name)} doit la valider avant de vous adresser son devis.
            </p>
            {reasons.length > 0 ? (
              <>
                <p className="font-medium">Points à vérifier par {String(c.name)} :</p>
                <ul className="list-disc pl-5">
                  {reasons.map((r, i) => <li key={i}>{r}</li>)}
                </ul>
              </>
            ) : null}
          </div>
        </div>
      ) : (
        <p className="rounded-md border border-brand/30 bg-brand-soft p-3 text-sm">
          {quote.origin === "automatic"
            ? `Devis établi automatiquement selon les conditions de ${String(c.name)} : l'inventaire a été reconnu sans incertitude.`
            : quote.origin === "customer_validation"
              ? `Devis établi selon la grille de ${String(c.name)} à partir de l'inventaire que vous avez validé. Vous pouvez l'accepter dès maintenant ; ${String(c.name)} vérifie votre inventaire et vous informera de toute modification.`
              : quote.origin === "verification"
                ? `Devis établi par ${String(c.name)} après vérification de votre inventaire.`
                : `Devis vérifié et envoyé par ${String(c.name)}.`}
          {quote.valid_until ? ` Valable jusqu'au ${formatDate(quote.valid_until)}.` : ""}
        </p>
      )}

      <section className="grid gap-4 sm:grid-cols-2">
        <Address title="Départ" d={quote.request.origin} />
        <Address title="Arrivée" d={quote.request.destination} />
        <div>
          <p className="text-xs font-semibold tracking-wide text-ink-muted uppercase">Client</p>
          <p className="text-sm">{quote.request.customer?.full_name}</p>
        </div>
        <div>
          <p className="text-xs font-semibold tracking-wide text-ink-muted uppercase">Date souhaitée</p>
          <p className="text-sm">
            {quote.request.moving_date ? formatDate(quote.request.moving_date) : "À convenir"}
            {quote.request.moving_date_flexible ? " (flexible)" : ""}
          </p>
        </div>
        {quote.distance_km !== null ? (
          <div>
            <p className="text-xs font-semibold tracking-wide text-ink-muted uppercase">Distance</p>
            <p className="text-sm">
              {quote.distance_km.toLocaleString("fr-FR")} km {quote.distance_method === "estimate" ? "(estimation)" : "(itinéraire routier)"}
            </p>
          </div>
        ) : null}
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="font-semibold">Volume</h3>
        <p className="text-2xl font-bold tabular-nums">
          {formatVolume(v.estimatedM3)}
          {v.maxM3 > v.estimatedM3 ? <span className="text-base font-medium text-ink-secondary"> à {formatVolume(v.maxM3)}</span> : null}
        </p>
        <p className="text-sm text-ink-secondary">
          Volume facturé : {formatVolume(v.billable_m3)} (arrondi au dixième de m³ supérieur).
          {v.potentialM3 > 0 ? ` ${formatVolume(v.potentialM3)} d'objets incertains ne sont pas comptés.` : ""}
        </p>
        <details className="rounded-md border border-border">
          <summary className="cursor-pointer px-3 py-2 text-sm font-medium">Inventaire ({quote.inventory.length} lignes)</summary>
          <div className="flex flex-col gap-3 px-3 pb-3">
            {[...rooms.entries()].map(([room, items]) => (
              <div key={room}>
                <p className="text-sm font-semibold">{room}</p>
                <ul className="divide-y divide-border text-sm">
                  {items.map((i, index) => (
                    <li key={index} className="flex justify-between gap-3 py-1">
                      <span className="min-w-0">
                        {i.quantity > 1 ? `${i.quantity} × ` : ""}
                        {i.name}
                        {i.bucket === "potential" ? <span className="text-ink-muted"> (non compté)</span> : null}
                      </span>
                      <span className={`shrink-0 ${LEVEL_LABEL[i.level]?.className ?? ""}`}>{LEVEL_LABEL[i.level]?.label}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </details>
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="font-semibold">Détail du prix</h3>
        <table className="w-full text-sm">
          <thead className="sr-only">
            <tr><th>Prestation</th><th>Montant HT</th></tr>
          </thead>
          <tbody className="divide-y divide-border">
            {quote.lines.map((l, i) => (
              <tr key={i}>
                <td className="py-2 pr-3">
                  <span className="block">{l.label}</span>
                  <span className="block text-xs text-ink-muted">{l.detail}</span>
                </td>
                <td className="py-2 text-right tabular-nums whitespace-nowrap">{formatEuros(l.amount_cents)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t-2 border-border-input">
            <tr><td className="pt-2">Total HT</td><td className="pt-2 text-right tabular-nums">{formatEuros(quote.total_ht_cents)}</td></tr>
            <tr><td>TVA ({quote.vat_rate.toLocaleString("fr-FR")} %)</td><td className="text-right tabular-nums">{formatEuros(quote.vat_cents)}</td></tr>
            <tr className="text-lg font-bold"><td className="pt-1">Total TTC</td><td className="pt-1 text-right tabular-nums">{formatEuros(quote.total_ttc_cents)}</td></tr>
          </tfoot>
        </table>
        {v.upper_total_ttc_cents && v.upper_total_ttc_cents > quote.total_ttc_cents ? (
          <p className="text-sm text-ink-secondary">Si tous les objets incertains devaient être déménagés : jusqu&apos;à {formatEuros(v.upper_total_ttc_cents)} TTC.</p>
        ) : null}
      </section>

      {quote.assumptions.length > 0 ? (
        <section className="flex gap-2 rounded-md bg-surface-subtle p-3 text-sm">
          <Info aria-hidden className="mt-0.5 size-4 shrink-0 text-ink-muted" />
          <ul className="flex flex-col gap-1">
            {quote.assumptions.map((a, i) => <li key={i}>{a}</li>)}
          </ul>
        </section>
      ) : null}

      <section className="flex flex-col gap-2 text-sm text-ink-secondary">
        <h3 className="font-semibold text-ink">Conditions de {String(c.name)}</h3>
        {[
          ["Assurance", c.insurance_info],
          ["Paiement", c.payment_terms],
          ["Réserves à la livraison", c.reserves_terms],
          ["Responsabilité", c.liability_terms],
          ["Conditions générales", c.quote_terms],
        ].map(([title, text]) =>
          text ? (
            <div key={String(title)}>
              <p className="font-medium text-ink">{title}</p>
              <p className="whitespace-pre-line">{String(text)}</p>
            </div>
          ) : null,
        )}
        {audience === "customer" && !c.quote_terms && !c.insurance_info ? <p>Les conditions générales vous seront communiquées avec le devis définitif.</p> : null}
      </section>
    </article>
  );
}
