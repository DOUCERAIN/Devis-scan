import type { ActionState } from "@/lib/errors";

/** Champ d'erreur et valeur précédente d'un formulaire, pour un champ donné. */
export function fieldProps(state: ActionState, name: string, fallback?: string | number | null) {
  const error = state.status === "error" ? state.fieldErrors?.[name] : undefined;
  const previous = state.status === "error" ? state.values?.[name] : undefined;
  const value = previous ?? (fallback === null || fallback === undefined ? undefined : String(fallback));
  return { name, error, defaultValue: value };
}
