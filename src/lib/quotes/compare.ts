/**
 * Comparaison des conditions de deux devis (montant, détail des prix, volume facturé).
 * Sert à décider si une correction de l'inventaire exige l'accord du client (nouvelle version
 * ou avenant) ou si une simple trace suffit (conditions identiques).
 */
export type QuoteTerms = {
  totalTtcCents: number;
  totalHtCents: number;
  billableM3: number | null;
  lines: { code: string; label: string; quantity: number; amount_cents: number }[];
};

export type TermsComparison = { identical: boolean; differences: string[] };

const euros = (cents: number) => `${(cents / 100).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
const m3 = (v: number) => `${v.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} m³`;

export function compareQuoteTerms(before: QuoteTerms, after: QuoteTerms): TermsComparison {
  const differences: string[] = [];
  if (before.totalTtcCents !== after.totalTtcCents) differences.push(`Montant TTC : ${euros(before.totalTtcCents)} → ${euros(after.totalTtcCents)}`);
  else if (before.totalHtCents !== after.totalHtCents) differences.push(`Montant HT : ${euros(before.totalHtCents)} → ${euros(after.totalHtCents)}`);
  if ((before.billableM3 ?? null) !== (after.billableM3 ?? null)) {
    differences.push(`Volume facturé : ${before.billableM3 === null ? "—" : m3(before.billableM3)} → ${after.billableM3 === null ? "—" : m3(after.billableM3)}`);
  }
  const key = (l: QuoteTerms["lines"][number]) => `${l.code}\u0000${l.label}`;
  const old = new Map(before.lines.map((l) => [key(l), l]));
  const next = new Map(after.lines.map((l) => [key(l), l]));
  for (const [k, l] of next) {
    const o = old.get(k);
    if (!o) differences.push(`Ligne ajoutée : ${l.label} (${euros(l.amount_cents)})`);
    else if (o.amount_cents !== l.amount_cents || o.quantity !== l.quantity) differences.push(`${l.label} : ${euros(o.amount_cents)} → ${euros(l.amount_cents)}`);
  }
  for (const [k, l] of old) if (!next.has(k)) differences.push(`Ligne retirée : ${l.label} (${euros(l.amount_cents)})`);
  return { identical: differences.length === 0, differences };
}
