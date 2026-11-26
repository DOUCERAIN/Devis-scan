"use client";

import { useActionState } from "react";
import { saveOptions } from "../../actions";
import { idleState } from "@/lib/errors";
import { SubmitButton } from "@/components/forms/SubmitButton";
import { FormMessage } from "@/components/forms/FormMessage";

/** Option proposée au client : nom, description et mode de calcul, jamais son prix (réservé au déménageur). */
export type OptionChoice = { id: string; name: string; description: string | null; pricing_mode: "fixed" | "per_m3" | "per_item" };

export function OptionsForm({ slug, options, selected }: { slug: string; options: OptionChoice[]; selected: { option_id: string; quantity: number }[] }) {
  const [state, action] = useActionState(saveOptions, idleState);
  const chosen = new Map(selected.map((s) => [s.option_id, s.quantity]));
  return (
    <form action={action} className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-4 sm:p-6">
      <input type="hidden" name="slug" value={slug} />
      <div>
        <h2 className="text-lg font-semibold">Options proposées</h2>
        <p className="text-sm text-ink-secondary">Cochez les services souhaités : ils seront pris en compte dans le prix total de votre devis.</p>
      </div>
      <ul className="flex flex-col gap-3">
        {options.map((o) => (
          <li key={o.id} className="flex flex-wrap items-start gap-3 rounded-md border border-border p-3">
            <input id={`opt-${o.id}`} type="checkbox" name="option" value={o.id} defaultChecked={chosen.has(o.id)} className="mt-1 size-5 accent-[var(--ds-brand)]" />
            <label htmlFor={`opt-${o.id}`} className="min-w-0 flex-1">
              <span className="block font-medium">{o.name}</span>
              {o.description ? <span className="block text-sm text-ink-secondary">{o.description}</span> : null}
            </label>
            {o.pricing_mode === "per_item" ? (
              <label className="flex items-center gap-2 text-sm">
                Quantité
                <input type="number" name={`quantity_${o.id}`} min={1} max={99} defaultValue={chosen.get(o.id) ?? 1} className="w-20 rounded-md border border-border-input px-2 py-1" />
              </label>
            ) : null}
          </li>
        ))}
      </ul>
      <FormMessage state={state} />
      <SubmitButton variant="secondary" pendingLabel="Enregistrement…">Enregistrer mes options</SubmitButton>
    </form>
  );
}
