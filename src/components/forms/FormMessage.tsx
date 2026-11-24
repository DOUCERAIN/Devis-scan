import type { ActionState } from "@/lib/errors";
import { Alert } from "@/components/ui/Alert";

/** Message global d'un formulaire après envoi (succès ou erreur). */
export function FormMessage({ state, className }: { state: ActionState; className?: string }) {
  if (state.status === "idle") return null;
  return (
    <Alert tone={state.status === "success" ? "success" : "danger"} title={state.message} className={className} />
  );
}
