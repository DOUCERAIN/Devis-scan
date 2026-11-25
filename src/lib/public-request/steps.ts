/**
 * Étapes du parcours particulier (ordre d'affichage). L'étape « inventaire » dépend de la méthode
 * choisie : vidéos (pièces puis vidéos) ou inventaire manuel par catégories.
 */
export const STEPS = [
  { key: "trajet", label: "Déménagement" },
  { key: "coordonnees", label: "Coordonnées" },
  { key: "methode", label: "Méthode" },
  { key: "inventaire", label: "Inventaire" },
  { key: "recapitulatif", label: "Récapitulatif" },
] as const;

export type StepKey = (typeof STEPS)[number]["key"];
export type PageKey = StepKey | "pieces" | "videos" | "envoyee" | "logements";
export type InventoryMethod = "video" | "manual" | null | undefined;

export function stepIndex(key: StepKey): number {
  return STEPS.findIndex((s) => s.key === key);
}

/** Adresse d'une page du parcours ; l'étape « inventaire » mène aux pièces à filmer pour la méthode vidéo. */
export function stepHref(slug: string, key: PageKey, method?: InventoryMethod): string {
  const page = key === "inventaire" && method === "video" ? "pieces" : key;
  return `/d/${slug}/demande/${page}`;
}

type DraftLike = {
  moving_date: string | null;
  inventory_method: InventoryMethod;
  customer: { privacy_accepted: boolean; phone: string | null } | null;
  dwellings: Partial<Record<"origin" | "destination", { floor: number | null; housing_type: string | null } | undefined>>;
  rooms: { videos: unknown[] }[];
  item_count: number;
};

/** Dernière étape accessible (index dans STEPS) selon ce qui est déjà rempli. */
export function reachableStep(draft: DraftLike | null): number {
  if (!draft) return 0;
  const placesDone = (["origin", "destination"] as const).every((k) => draft.dwellings[k]?.floor !== null && draft.dwellings[k]?.floor !== undefined && draft.dwellings[k]?.housing_type);
  if (!placesDone || !draft.moving_date) return 0;
  if (!draft.customer?.privacy_accepted || !draft.customer.phone) return 1;
  if (!draft.inventory_method) return 2;
  const inventoryDone = draft.inventory_method === "manual" ? draft.item_count > 0 : draft.rooms.some((r) => r.videos.length > 0);
  return inventoryDone ? 4 : 3;
}
