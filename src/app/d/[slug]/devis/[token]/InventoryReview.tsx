"use client";

import { useActionState, useState, useTransition } from "react";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { validateCustomerInventory } from "./actions";
import { idleState } from "@/lib/errors";
import { SubmitButton } from "@/components/forms/SubmitButton";
import { FormMessage } from "@/components/forms/FormMessage";
import { CUSTOMER_INVENTORY_WARNING, DUPLICATE_DECISION_LABELS } from "@/lib/inventory/duplicates";

type ReviewItem = { id: string; name: string; room: string; quantity: number };
export type ReviewDuplicate = ReviewItem & { explanation: string; images: string[]; otherImages: string[]; otherLabel: string | null };

/**
 * Validation de l'inventaire (modifiable juste au-dessus) par le client. Les éléments signalés comme doublons possibles
 * sont regroupés dans « Éléments à vérifier » : une réponse est obligatoire pour chacun (contrôlée aussi
 * côté serveur et en base), puis l'avertissement doit être accepté.
 */
export function InventoryReview({ slug, token, duplicates, empty, blocked = null, beforeSubmit }: {
  slug: string; token: string; duplicates: ReviewDuplicate[]; empty: boolean;
  /** Raison d'attendre avant de valider (cartons non renseignés…), affichée sous le bouton. */
  blocked?: string | null;
  /** Attend la fin de l'enregistrement de l'inventaire avant l'envoi du formulaire. */
  beforeSubmit?: () => Promise<void>;
}) {
  const [state, action, validating] = useActionState(validateCustomerInventory, idleState);
  const [flushing, startTransition] = useTransition();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const remaining = duplicates.filter((d) => !answers[d.id]).length;
  const errorFor = (name: string) => (state.status === "error" ? state.fieldErrors?.[name] : undefined);

  return (
    <form action={action} className="flex flex-col gap-5" onSubmit={(e) => {
      if (!beforeSubmit) return;
      // Les dernières modifications de l'inventaire sont enregistrées avant la validation.
      e.preventDefault();
      const data = new FormData(e.currentTarget);
      startTransition(async () => {
        await beforeSubmit();
        action(data);
      });
    }}>
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="token" value={token} />
      {duplicates.length > 0 ? (
        <section className="flex flex-col gap-3" aria-labelledby="to-check-title">
          <h2 id="to-check-title" className="text-[20px] leading-[28px] font-bold">Éléments à vérifier</h2>
          <p className="text-sm text-ink-secondary">
            Ces meubles ont peut-être été filmés deux fois. Pour chacun, indiquez s&apos;il s&apos;agit d&apos;un autre meuble ou du même meuble.
            {remaining > 0 ? <strong> {remaining} réponse{remaining > 1 ? "s" : ""} attendue{remaining > 1 ? "s" : ""}.</strong> : <span className="text-success-text"> Toutes les réponses sont données.</span>}
          </p>
          {duplicates.map((d) => (
            <fieldset key={d.id} className="flex flex-col gap-3 rounded-lg border border-duplicate bg-duplicate-soft p-4" data-testid="to-check">
              <input type="hidden" name="item" value={d.id} />
              <legend className="sr-only">{d.name}</legend>
              <p className="font-semibold">
                {d.name} <span className="font-normal text-ink-secondary">· {d.room}{d.quantity > 1 ? ` · × ${d.quantity}` : ""}</span>
              </p>
              <p className="text-sm">{d.explanation}</p>
              {d.images.length > 0 || d.otherImages.length > 0 ? (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {d.images.map((src, n) => (
                    // eslint-disable-next-line @next/next/no-img-element -- lien signé temporaire
                    <img key={`a${n}`} src={src} alt={`${d.name} : image ${n + 1}`} className="aspect-video w-full rounded-md object-cover" />
                  ))}
                  {d.otherImages.map((src, n) => (
                    // eslint-disable-next-line @next/next/no-img-element -- lien signé temporaire
                    <img key={`b${n}`} src={src} alt={`${d.otherLabel ?? "Élément déjà dans l'inventaire"} : image ${n + 1}`} className="aspect-video w-full rounded-md object-cover ring-2 ring-border" />
                  ))}
                </div>
              ) : null}
              {d.otherLabel ? <p className="text-xs text-ink-secondary">Déjà dans votre inventaire : {d.otherLabel}</p> : null}
              <div className="flex flex-col gap-2" role="radiogroup" aria-label={`Réponse pour ${d.name}`}>
                {(["distinct", "same"] as const).map((value) => (
                  <label key={value} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md border border-border-input bg-surface px-3 py-2 text-sm has-[:checked]:border-brand has-[:checked]:ring-1 has-[:checked]:ring-brand">
                    <input type="radio" name={`decision_${d.id}`} value={value} required className="size-[18px] accent-brand"
                      onChange={() => setAnswers((a) => ({ ...a, [d.id]: value }))} />
                    {DUPLICATE_DECISION_LABELS[value]}
                  </label>
                ))}
              </div>
              {errorFor(`decision_${d.id}`) ? <p className="text-sm text-danger-text">{errorFor(`decision_${d.id}`)}</p> : null}
            </fieldset>
          ))}
        </section>
      ) : null}

      <section className="flex flex-col gap-3 rounded-lg border border-warning bg-warning-soft p-4" aria-labelledby="warning-title">
        <h2 id="warning-title" className="flex items-center gap-2 font-semibold">
          <AlertTriangle aria-hidden className="size-5 text-warning-text" /> Avant de valider
        </h2>
        <p className="text-sm">{CUSTOMER_INVENTORY_WARNING}</p>
        <label className="flex items-start gap-3 text-sm font-medium">
          <input type="checkbox" name="acknowledged" required className="mt-0.5 size-[18px] accent-brand" />
          J&apos;ai pris connaissance de cet avertissement.
        </label>
        {errorFor("acknowledged") ? <p className="text-sm text-danger-text">{errorFor("acknowledged")}</p> : null}
      </section>

      <FormMessage state={state} />
      <SubmitButton pendingLabel="Validation…" disabled={empty || Boolean(blocked) || validating || flushing}>
        {validating || flushing ? "Validation…" : <><CheckCircle2 aria-hidden className="size-4" /> Valider mon inventaire et recevoir mon devis</>}
      </SubmitButton>
      {blocked ? <p className="text-sm text-ink-secondary" data-testid="validate-blocked">{blocked}</p> : null}
    </form>
  );
}
