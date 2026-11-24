/**
 * Moteur de tarification déterministe.
 *
 * - Utilise exclusivement la grille de l'entreprise passée en paramètre (jamais un prix libre de l'IA).
 * - Tous les montants sont calculés en centimes entiers ; arrondis explicites :
 *   - volume facturé : arrondi au dixième de m³ SUPÉRIEUR (18,32 → 18,4 m³) ;
 *   - distance : arrondie au kilomètre supérieur ;
 *   - portage : par tranche de 10 m entamée au-delà de la distance gratuite ;
 *   - chaque ligne : arrondie au centime le plus proche (demi-centime vers le haut) ;
 *   - TVA : calculée sur le total HT, arrondie au centime le plus proche.
 * - Une donnée manquante indispensable produit un « blocage » : aucun prix n'est alors affiché.
 */

export type PricingSettings = {
  price_per_m3: number;
  minimum_price: number;
  travel_fee: number;
  included_distance_km: number;
  price_per_extra_km: number;
  floor_fee_without_elevator: number;
  floor_fee_small_elevator: number;
  free_carrying_distance_m: number;
  carrying_fee_per_10m: number;
  heavy_item_fee: number;
  vat_rate: number;
};

export type PricingOption = { id: string; name: string; pricing_mode: "fixed" | "per_m3" | "per_item"; price: number };
export type ItemSurcharge = { name: string; surcharge: number };
export type SelectedOption = { option_id: string; quantity: number };

export type DwellingAccess = {
  kind: "origin" | "destination";
  floor: number | null;
  elevator: "none" | "small" | "standard" | "large" | null;
  carrying_distance_m: number | null;
};

export type HeavyItem = { name: string; catalogName: string | null; quantity: number };

export type PricingInput = {
  settings: PricingSettings;
  options: PricingOption[];
  surcharges: ItemSurcharge[];
  selectedOptions: SelectedOption[];
  volumeM3: number;
  distanceKm: number | null;
  distanceMethod: "route" | "estimate" | null;
  dwellings: DwellingAccess[];
  heavyItems: HeavyItem[];
};

export type QuoteLine = {
  code: "volume" | "travel" | "distance" | "floors" | "carrying" | "heavy" | "option" | "minimum";
  label: string;
  detail: string;
  quantity: number;
  unit: string;
  unit_price_cents: number;
  amount_cents: number;
};

export type PricingResult =
  | {
      ok: true;
      lines: QuoteLine[];
      billableVolumeM3: number;
      totalHtCents: number;
      vatRate: number;
      vatCents: number;
      totalTtcCents: number;
      assumptions: string[];
    }
  | { ok: false; blockers: string[]; assumptions: string[] };

export const toCents = (euros: number) => Math.round(euros * 100);
const roundCents = (value: number) => Math.round(value + Number.EPSILON);

/** Volume facturé : dixième de m³ supérieur (tolérance pour les erreurs de virgule flottante). */
export function billableVolume(volumeM3: number): number {
  return Math.ceil(Math.round(volumeM3 * 1000) / 100) / 10;
}

export function formatNumberFr(value: number, decimals = 1): string {
  return value.toLocaleString("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: decimals });
}

const KIND_LABEL = { origin: "départ", destination: "arrivée" } as const;

function normalizeName(text: string): string {
  return text.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
}

export function computePrice(input: PricingInput): PricingResult {
  const { settings: s } = input;
  const lines: QuoteLine[] = [];
  const blockers: string[] = [];
  const assumptions: string[] = [];

  // Volume
  const volume = billableVolume(Math.max(0, input.volumeM3));
  if (volume <= 0) blockers.push("Aucun volume n'a pu être estimé.");
  const pricePerM3 = toCents(s.price_per_m3);
  if (pricePerM3 <= 0) blockers.push("Le prix au m³ n'est pas renseigné.");
  lines.push({
    code: "volume",
    label: "Volume à déménager",
    detail: `${formatNumberFr(volume)} m³ × ${formatNumberFr(s.price_per_m3, 2)} €`,
    quantity: volume,
    unit: "m³",
    unit_price_cents: pricePerM3,
    amount_cents: roundCents((Math.round(volume * 10) * pricePerM3) / 10),
  });

  // Déplacement
  if (s.travel_fee > 0) {
    lines.push({ code: "travel", label: "Frais de déplacement", detail: "Forfait", quantity: 1, unit: "forfait", unit_price_cents: toCents(s.travel_fee), amount_cents: toCents(s.travel_fee) });
  }

  // Distance au-delà de la distance incluse
  if (input.distanceKm === null) {
    if (s.price_per_extra_km > 0) blockers.push("La distance entre les deux adresses n'a pas pu être calculée.");
    else assumptions.push("Distance non calculée (sans incidence : aucun tarif kilométrique).");
  } else {
    const km = Math.ceil(input.distanceKm);
    if (input.distanceMethod === "estimate") assumptions.push(`Distance estimée à vol d'oiseau corrigé (${km} km), à confirmer.`);
    const extra = Math.max(0, km - s.included_distance_km);
    if (extra > 0 && s.price_per_extra_km > 0) {
      const unit = toCents(s.price_per_extra_km);
      lines.push({
        code: "distance",
        label: "Kilomètres supplémentaires",
        detail: `${extra} km au-delà des ${s.included_distance_km} km inclus`,
        quantity: extra,
        unit: "km",
        unit_price_cents: unit,
        amount_cents: extra * unit,
      });
    }
  }

  // Étages et portage, pour chaque logement
  for (const d of input.dwellings) {
    const where = KIND_LABEL[d.kind];
    if (d.floor === null) {
      assumptions.push(`Étage au ${where} non renseigné : aucun supplément d'étage appliqué.`);
    } else if (d.floor > 0) {
      const elevator = d.elevator ?? "none";
      if (d.elevator === null) assumptions.push(`Ascenseur au ${where} non précisé : considéré comme absent.`);
      const fee = elevator === "none" ? s.floor_fee_without_elevator : elevator === "small" ? s.floor_fee_small_elevator : 0;
      if (fee > 0) {
        const unit = toCents(fee);
        lines.push({
          code: "floors",
          label: `Étages au ${where}`,
          detail: `${d.floor} étage${d.floor > 1 ? "s" : ""} ${elevator === "none" ? "sans ascenseur" : "avec petit ascenseur"}`,
          quantity: d.floor,
          unit: "étage",
          unit_price_cents: unit,
          amount_cents: d.floor * unit,
        });
      }
    }
    if (d.carrying_distance_m === null) {
      assumptions.push(`Distance de portage au ${where} non renseignée : aucun supplément de portage appliqué.`);
    } else {
      const extra = Math.max(0, d.carrying_distance_m - s.free_carrying_distance_m);
      const tranches = Math.ceil(extra / 10);
      if (tranches > 0 && s.carrying_fee_per_10m > 0) {
        const unit = toCents(s.carrying_fee_per_10m);
        lines.push({
          code: "carrying",
          label: `Portage au ${where}`,
          detail: `${d.carrying_distance_m} m, dont ${extra} m au-delà des ${s.free_carrying_distance_m} m gratuits (${tranches} tranche${tranches > 1 ? "s" : ""} de 10 m)`,
          quantity: tranches,
          unit: "tranche",
          unit_price_cents: unit,
          amount_cents: tranches * unit,
        });
      }
    }
  }

  // Objets lourds : supplément spécifique de l'entreprise, sinon supplément par défaut
  const surchargeByName = new Map(input.surcharges.map((x) => [normalizeName(x.name), x.surcharge]));
  for (const item of input.heavyItems) {
    const specific = surchargeByName.get(normalizeName(item.name)) ?? (item.catalogName ? surchargeByName.get(normalizeName(item.catalogName)) : undefined);
    const fee = specific ?? s.heavy_item_fee;
    if (fee <= 0) continue;
    const unit = toCents(fee);
    lines.push({
      code: "heavy",
      label: `Objet lourd : ${item.name}`,
      detail: specific !== undefined ? "Supplément spécifique" : "Supplément objet lourd",
      quantity: item.quantity,
      unit: "objet",
      unit_price_cents: unit,
      amount_cents: item.quantity * unit,
    });
  }

  // Options choisies par le client
  const optionsById = new Map(input.options.map((o) => [o.id, o]));
  for (const selected of input.selectedOptions) {
    const option = optionsById.get(selected.option_id);
    if (!option) {
      assumptions.push("Une option choisie n'est plus proposée par l'entreprise et n'a pas été comptée.");
      continue;
    }
    const unit = toCents(option.price);
    if (option.pricing_mode === "per_m3") {
      lines.push({ code: "option", label: option.name, detail: `${formatNumberFr(volume)} m³ × ${formatNumberFr(option.price, 2)} €`, quantity: volume, unit: "m³", unit_price_cents: unit, amount_cents: roundCents((Math.round(volume * 10) * unit) / 10) });
    } else {
      const quantity = option.pricing_mode === "per_item" ? Math.max(1, selected.quantity) : 1;
      lines.push({ code: "option", label: option.name, detail: option.pricing_mode === "per_item" ? `${quantity} × ${formatNumberFr(option.price, 2)} €` : "Forfait", quantity, unit: option.pricing_mode === "per_item" ? "unité" : "forfait", unit_price_cents: unit, amount_cents: quantity * unit });
    }
  }

  if (blockers.length > 0) return { ok: false, blockers, assumptions };

  // Forfait minimum
  let totalHt = lines.reduce((sum, l) => sum + l.amount_cents, 0);
  const minimum = toCents(s.minimum_price);
  if (totalHt < minimum) {
    const diff = minimum - totalHt;
    lines.push({ code: "minimum", label: "Ajustement au forfait minimum", detail: `Forfait minimum de ${formatNumberFr(s.minimum_price, 2)} € HT`, quantity: 1, unit: "forfait", unit_price_cents: diff, amount_cents: diff });
    totalHt = minimum;
  }

  const vatCents = roundCents((totalHt * s.vat_rate) / 100);
  return { ok: true, lines, billableVolumeM3: volume, totalHtCents: totalHt, vatRate: s.vat_rate, vatCents, totalTtcCents: totalHt + vatCents, assumptions };
}

/** Format monétaire français : 1 640,00 €. */
export function formatEuros(cents: number): string {
  return (cents / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
}
