"use client";

import { useActionState } from "react";
import { respondToQuote } from "./actions";
import { idleState } from "@/lib/errors";
import { SubmitButton } from "@/components/forms/SubmitButton";
import { FormMessage } from "@/components/forms/FormMessage";

export function RespondForm({ slug, token, quoteId, label }: { slug: string; token: string; quoteId: string; label?: string }) {
  const [state, action] = useActionState(respondToQuote, idleState);
  return (
    <form action={action} className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="quote_id" value={quoteId} />
      <p className="text-sm">{label ?? "En acceptant, vous donnez votre accord sur ce devis tel qu'il est présenté ci-dessous."}</p>
      <FormMessage state={state} />
      <div className="flex flex-col gap-2 sm:flex-row">
        <SubmitButton name="decision" value="accepted" pendingLabel="Envoi…">Accepter le devis</SubmitButton>
        <SubmitButton name="decision" value="refused" variant="secondary" pendingLabel="Envoi…">Refuser</SubmitButton>
      </div>
    </form>
  );
}
