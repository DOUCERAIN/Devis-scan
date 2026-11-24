import type { Draft } from "@/lib/public-request/service";

/** Dernière étape accessible selon ce qui est déjà rempli (pour la barre de progression). */
export function reachableStep(draft: Draft | null): number {
  if (!draft) return 0;
  const o = draft.dwellings.origin;
  if (!o?.housing_type) return 1;
  if (draft.rooms.length === 0) return 2;
  return 4;
}
