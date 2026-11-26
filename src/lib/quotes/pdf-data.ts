import type { PublicQuote } from "@/lib/public-request/service";
import { formatEuros } from "@/lib/pricing/engine";
import { formatVolume } from "@/lib/inventory/volume";
import { formatDate } from "@/lib/requests/labels";
import { quoteKindLabel } from "@/components/quote/QuoteDocument";
import { brand } from "@/config/brand";
import type { PdfQuote } from "./pdf";

const LEVEL: Record<string, string> = { human: "confirmé", sure: "sûr", verify: "à vérifier", uncertain: "incertain" };
const ELEVATOR: Record<string, string> = { none: "sans ascenseur", small: "petit ascenseur", standard: "ascenseur", large: "grand ascenseur" };

function addressLines(d: Record<string, unknown> | null): string[] {
  if (!d) return ["Non précisée"];
  const floor = typeof d.floor === "number" ? (d.floor === 0 ? "rez-de-chaussée" : `${d.floor}e étage`) : null;
  return [
    [d.address_line, [d.postal_code, d.city].filter(Boolean).join(" ")].filter(Boolean).join(", ") || "Adresse non précisée",
    [floor, typeof d.elevator === "string" ? ELEVATOR[d.elevator] : null, typeof d.carrying_distance_m === "number" ? `portage ${d.carrying_distance_m} m` : null].filter(Boolean).join(", "),
  ].filter(Boolean);
}

export function toPdfQuote(q: PublicQuote): PdfQuote {
  const c = q.company;
  const s = (v: unknown) => (v === null || v === undefined || v === "" ? null : String(v));
  const rooms = new Map<string, string[]>();
  for (const i of q.inventory) {
    const line = `${i.quantity > 1 ? `${i.quantity} × ` : ""}${i.name} - ${LEVEL[i.level] ?? ""}${i.bucket === "potential" ? " (non compté)" : ""}`;
    rooms.set(i.room, [...(rooms.get(i.room) ?? []), line]);
  }
  return {
    title: quoteKindLabel(q),
    reference: `${q.request.reference}-V${q.version}`,
    createdAt: formatDate(q.created_at),
    validUntil: q.valid_until ? formatDate(q.valid_until) : null,
    isEstimate: quoteKindLabel(q) !== "Devis",
    company: {
      name: s(c.legal_name) ?? String(c.name),
      color: s(c.brand_color),
      legal: [
        [s(c.address_line1), s(c.address_line2), [s(c.postal_code), s(c.city)].filter(Boolean).join(" ")].filter(Boolean).join(", "),
        [s(c.siret) ? `SIRET ${c.siret}` : null, s(c.vat_number) ? `TVA intracommunautaire ${c.vat_number}` : null].filter(Boolean).join(" - "),
        [s(c.phone), s(c.email), s(c.website)].filter(Boolean).join(" - "),
      ].filter(Boolean),
    },
    customer: [q.request.customer?.full_name, q.request.customer?.email, q.request.customer?.phone].filter((x): x is string => Boolean(x)),
    addresses: [
      { title: "Adresse de départ", lines: addressLines(q.request.origin) },
      { title: "Adresse d'arrivée", lines: addressLines(q.request.destination) },
    ],
    facts: [
      ["Date souhaitée", `${q.request.moving_date ? formatDate(q.request.moving_date) : "à convenir"}${q.request.moving_date_flexible ? " (flexible)" : ""}`],
      ["Volume estimé", `${formatVolume(q.volume.estimatedM3)}${q.volume.maxM3 > q.volume.estimatedM3 ? ` (jusqu'à ${formatVolume(q.volume.maxM3)} avec les objets incertains)` : ""}`],
      ["Volume facturé", formatVolume(q.volume.billable_m3)],
      ...(q.distance_km !== null ? ([["Distance", `${q.distance_km.toLocaleString("fr-FR")} km${q.distance_method === "estimate" ? " (estimation)" : ""}`]] as [string, string][]) : []),
    ],
    inventory: [...rooms.entries()].map(([room, items]) => ({ room, items })),
    // Devis du client : prestations sans montant par ligne (get_public_quote_view ne les transmet plus).
    lines: q.lines.map((l) => ({ label: l.label, detail: l.detail, amount: l.amount_cents === undefined ? "Inclus" : formatEuros(l.amount_cents) })),
    pricesHidden: q.prices_hidden === true || q.lines.every((l) => l.amount_cents === undefined),
    totals: [
      ["Total HT", formatEuros(q.total_ht_cents)],
      [`TVA (${q.vat_rate.toLocaleString("fr-FR")} %)`, formatEuros(q.vat_cents)],
      ["Total TTC", formatEuros(q.total_ttc_cents)],
    ],
    notes: [
      ...q.assumptions,
      ...(quoteKindLabel(q) !== "Devis"
        ? (q.review_reasons ?? []).filter((r) => !/Envoi automatique|Identité légale|Grille tarifaire|simulateur/.test(r)).map((r) => `À vérifier par l'entreprise : ${r}`)
        : []),
    ],
    terms: (
      [
        ["Assurance", s(c.insurance_info)],
        ["Conditions de paiement", s(c.payment_terms)],
        ["Réserves à la livraison", s(c.reserves_terms)],
        ["Responsabilité", s(c.liability_terms)],
        ["Conditions générales", s(c.quote_terms)],
      ] as [string, string | null][]
    ).filter((t): t is [string, string] => t[1] !== null),
    footer: `${String(c.name)} - document établi avec ${brand.name}`,
  };
}
