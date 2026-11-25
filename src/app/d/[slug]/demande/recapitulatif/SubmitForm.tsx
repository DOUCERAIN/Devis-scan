"use client";

import { useActionState } from "react";
import { AlertTriangle } from "lucide-react";
import { submitRequest } from "../../actions";
import { idleState } from "@/lib/errors";
import { TextArea } from "@/components/ui/Field";
import { SubmitButton } from "@/components/forms/SubmitButton";
import { FormMessage } from "@/components/forms/FormMessage";
import { fieldProps } from "@/components/forms/useFormValues";
import { MANUAL_INVENTORY_WARNING } from "@/lib/inventory/manual";

export function SubmitForm({ slug, notes, canSubmit, companyName, manual }: { slug: string; notes: string | null; canSubmit: boolean; companyName: string; manual: boolean }) {
  const [state, action] = useActionState(submitRequest, idleState);
  const err = (k: string) => (state.status === "error" ? state.fieldErrors?.[k] : undefined);
  return (
    <form action={action} className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-4 sm:p-6" noValidate>
      <input type="hidden" name="slug" value={slug} />
      <TextArea id="customer_notes" label="Informations complémentaires" optional rows={4}
        placeholder="Objets particuliers, contraintes d'horaires, questions…" {...fieldProps(state, "customer_notes", notes)} />
      {manual ? (
        <section className="flex flex-col gap-3 rounded-lg border border-warning bg-warning-soft p-4" aria-labelledby="warning-title">
          <h2 id="warning-title" className="flex items-center gap-2 font-semibold">
            <AlertTriangle aria-hidden className="size-5 text-warning-text" /> Avant d&apos;envoyer
          </h2>
          <p className="text-sm">{MANUAL_INVENTORY_WARNING}</p>
          <label className="flex items-start gap-3 text-sm font-medium">
            <input type="checkbox" name="acknowledged" className="mt-0.5 size-[18px] accent-brand" />
            J&apos;ai pris connaissance de cet avertissement.
          </label>
          {err("acknowledged") ? <p className="text-sm text-danger-text">{err("acknowledged")}</p> : null}
        </section>
      ) : null}
      <FormMessage state={state} />
      <SubmitButton size="lg" block disabled={!canSubmit} pendingLabel={manual ? "Calcul de votre devis…" : "Envoi en cours…"}>
        {manual ? "Valider mon inventaire et recevoir mon devis" : `Envoyer ma demande à ${companyName}`}
      </SubmitButton>
      <p className="text-center text-xs text-ink-muted">
        {manual ? `Votre demande est transmise en même temps à ${companyName}, qui vérifiera votre inventaire.` : "Après l'envoi, votre demande ne pourra plus être modifiée."}
      </p>
    </form>
  );
}
