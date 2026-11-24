"use client";

import { useActionState } from "react";
import { recalculateQuote } from "./inventory-actions";
import { idleState } from "@/lib/errors";
import { SubmitButton } from "@/components/forms/SubmitButton";
import { FormMessage } from "@/components/forms/FormMessage";

export function QuoteActions({ requestId, canSend }: { requestId: string; canSend: boolean }) {
  const [state, action] = useActionState(recalculateQuote, idleState);
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="request_id" value={requestId} />
      <FormMessage state={state} />
      <div className="flex flex-wrap gap-2">
        <SubmitButton variant="secondary" size="sm" pendingLabel="Calcul…">Recalculer (nouvelle version)</SubmitButton>
        {canSend ? (
          <SubmitButton name="send" value="1" size="sm" pendingLabel="Envoi…">Valider et envoyer au client</SubmitButton>
        ) : null}
      </div>
      <p className="text-xs text-ink-muted">Chaque calcul crée une nouvelle version ; les versions précédentes restent consultables et ne sont jamais modifiées.</p>
    </form>
  );
}
