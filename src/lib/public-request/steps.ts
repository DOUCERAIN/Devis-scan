/** Étapes du parcours particulier (ordre d'affichage). */
export const STEPS = [
  { key: "trajet", label: "Votre déménagement" },
  { key: "logements", label: "Vos logements" },
  { key: "pieces", label: "Vos pièces" },
  { key: "videos", label: "Vos vidéos" },
  { key: "recapitulatif", label: "Récapitulatif" },
] as const;

export type StepKey = (typeof STEPS)[number]["key"];

export function stepIndex(key: StepKey): number {
  return STEPS.findIndex((s) => s.key === key);
}

export function stepHref(slug: string, key: StepKey | "envoyee"): string {
  return `/d/${slug}/demande/${key}`;
}
