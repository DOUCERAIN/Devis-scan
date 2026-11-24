"use client";

import { useActionState } from "react";
import { submitRequest } from "../../actions";
import { idleState } from "@/lib/errors";
import { TextArea } from "@/components/ui/Field";
import { SubmitButton } from "@/components/forms/SubmitButton";
import { FormMessage } from "@/components/forms/FormMessage";
import { fieldProps } from "@/components/forms/useFormValues";

export function SubmitForm({ slug, notes, canSubmit, companyName }: { slug: string; notes: string | null; canSubmit: boolean; companyName: string }) {
  const [state, action] = useActionState(submitRequest, idleState);
  return (
    <form action={action} className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-4 sm:p-6" noValidate>
      <input type="hidden" name="slug" value={slug} />
      <TextArea id="customer_notes" label="Informations complémentaires" optional rows={4}
        placeholder="Objets particuliers, contraintes d'horaires, questions…" {...fieldProps(state, "customer_notes", notes)} />
      <FormMessage state={state} />
      <SubmitButton size="lg" block disabled={!canSubmit} pendingLabel="Envoi en cours…">Envoyer ma demande à {companyName}</SubmitButton>
      <p className="text-center text-xs text-ink-muted">Après l&apos;envoi, votre demande ne pourra plus être modifiée.</p>
    </form>
  );
}
