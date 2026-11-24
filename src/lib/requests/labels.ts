/** Libellés français des énumérations de la base. */
export const HOUSING_LABELS = {
  apartment: "Appartement",
  house: "Maison",
  storage_unit: "Garde-meubles / box",
  office: "Bureau",
  other: "Autre",
} as const;

export const ELEVATOR_LABELS = {
  none: "Pas d'ascenseur",
  small: "Petit ascenseur",
  standard: "Ascenseur standard",
  large: "Grand ascenseur / monte-charge",
} as const;

export function floorLabel(floor: number | null | undefined): string {
  if (floor === null || floor === undefined) return "Étage non précisé";
  if (floor === 0) return "Rez-de-chaussée";
  if (floor < 0) return `Sous-sol ${Math.abs(floor)}`;
  return floor === 1 ? "1er étage" : `${floor}e étage`;
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "Date non précisée";
  const date = new Date(value.length === 10 ? `${value}T12:00:00` : value);
  return date.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

export function formatDateTime(value: string): string {
  return new Date(value).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" });
}
