"use client";

import { useActionState } from "react";
import { CheckCheck, Send } from "lucide-react";
import { completeVerification } from "./verification-actions";
import { idleState } from "@/lib/errors";
import { fieldProps } from "@/components/forms/useFormValues";
import { SubmitButton } from "@/components/forms/SubmitButton";
import { FormMessage } from "@/components/forms/FormMessage";
import { TextArea } from "@/components/ui/Field";

/**
 * Fin de la vérification : confirmer les décisions du client (aucun changement pour lui), ou enregistrer
 * les corrections déjà faites dans l'inventaire avec leur raison (recalcul, comparaison, information du client).
 */
export function VerificationForm({ requestId, pendingCorrections }: { requestId: string; pendingCorrections: number }) {
  const [state, action] = useActionState(completeVerification, idleState);
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="request_id" value={requestId} />
      <FormMessage state={state} />
      {pendingCorrections === 0 ? (
        <>
          <p className="text-sm text-ink-secondary">Aucune correction depuis la validation du client. Si l&apos;inventaire vous convient, confirmez-le : le client n&apos;aura rien d&apos;autre à faire.</p>
          <SubmitButton name="intent" value="confirm" size="sm" pendingLabel="Enregistrement…">
            <CheckCheck aria-hidden className="size-4" /> Confirmer l&apos;inventaire et les décisions du client
          </SubmitButton>
          <p className="text-xs text-ink-muted">Pour corriger, modifiez d&apos;abord les objets dans l&apos;inventaire (ajout, retrait, quantité, doublon) : chaque correction est enregistrée avec son auteur.</p>
        </>
      ) : (
        <>
          <p className="text-sm text-ink-secondary">
            {pendingCorrections} correction{pendingCorrections > 1 ? "s" : ""} depuis la validation du client. Le devis sera recalculé et comparé à la version transmise :
            conditions identiques → simple trace ; sinon nouvelle version (ou avenant si le client a déjà accepté), soumise à son accord.
          </p>
          <TextArea id={`reason-${requestId}`} label="Raison de la modification (communiquée au client)" rows={3} maxLength={1000} {...fieldProps(state, "reason", "")} />
          <SubmitButton name="intent" value="correct" size="sm" pendingLabel="Enregistrement…">
            <Send aria-hidden className="size-4" /> Enregistrer les corrections et informer le client
          </SubmitButton>
        </>
      )}
    </form>
  );
}
