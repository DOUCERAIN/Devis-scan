"use client";

import { useActionState } from "react";
import { saveTrip } from "../../actions";
import { idleState } from "@/lib/errors";
import { TextField } from "@/components/ui/Field";
import { SubmitButton } from "@/components/forms/SubmitButton";
import { FormMessage } from "@/components/forms/FormMessage";
import { fieldProps } from "@/components/forms/useFormValues";
import { AddressField } from "@/components/customer/AddressField";
import type { Draft } from "@/lib/public-request/service";

export function TripForm({ slug, companyName, draft }: { slug: string; companyName: string; draft: Draft | null }) {
  const [state, action] = useActionState(saveTrip, idleState);
  const v = state.status === "error" ? state.values : undefined;
  const err = (k: string) => (state.status === "error" ? state.fieldErrors?.[k] : undefined);
  const addr = (k: "origin" | "destination") => ({
    address_line: v?.[`${k}.address_line`] ?? draft?.dwellings[k]?.address_line,
    postal_code: v?.[`${k}.postal_code`] ?? draft?.dwellings[k]?.postal_code,
    city: v?.[`${k}.city`] ?? draft?.dwellings[k]?.city,
    latitude: v?.[`${k}.latitude`] ?? draft?.dwellings[k]?.latitude,
    longitude: v?.[`${k}.longitude`] ?? draft?.dwellings[k]?.longitude,
  });
  const addrErr = (k: string) => ({ address_line: err(`${k}.address_line`), postal_code: err(`${k}.postal_code`), city: err(`${k}.city`) });
  const today = new Date().toISOString().slice(0, 10);
  const flexible = v ? v.moving_date_flexible === "on" : draft?.moving_date_flexible;

  return (
    <form action={action} className="flex flex-col gap-6" noValidate>
      <input type="hidden" name="slug" value={slug} />
      <FormMessage state={state} />

      <fieldset className="flex flex-col gap-5 rounded-lg border border-border bg-surface p-4 sm:p-6">
        <legend className="px-1 text-lg leading-[26px] font-semibold">Adresses</legend>
        <AddressField prefix="origin" label="Adresse de départ" values={addr("origin")} errors={addrErr("origin")} />
        <AddressField prefix="destination" label="Adresse d'arrivée" values={addr("destination")} errors={addrErr("destination")} />
      </fieldset>

      <fieldset className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-4 sm:p-6">
        <legend className="px-1 text-lg leading-[26px] font-semibold">Date du déménagement</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField id="moving_date" type="date" label="Date souhaitée" min={today} {...fieldProps(state, "moving_date", draft?.moving_date)} />
          <TextField id="alternative_moving_date" type="date" label="Date alternative" optional min={today}
            {...fieldProps(state, "alternative_moving_date", draft?.alternative_moving_date)} />
        </div>
        <label className="flex min-h-11 items-center gap-3 text-sm text-ink">
          <input type="checkbox" name="moving_date_flexible" defaultChecked={Boolean(flexible)} className="size-5 accent-brand" />
          Mes dates sont flexibles de quelques jours
        </label>
      </fieldset>

      <fieldset className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-4 sm:p-6">
        <legend className="px-1 text-lg leading-[26px] font-semibold">Vos coordonnées</legend>
        <TextField id="full_name" label="Nom et prénom" autoComplete="name" {...fieldProps(state, "customer.full_name", draft?.customer?.full_name)} />
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField id="email" type="email" label="E-mail" autoComplete="email" inputMode="email"
            help="Pour recevoir votre devis." {...fieldProps(state, "customer.email", draft?.customer?.email)} />
          <TextField id="phone" type="tel" label="Téléphone" optional autoComplete="tel" inputMode="tel"
            {...fieldProps(state, "customer.phone", draft?.customer?.phone)} />
        </div>
        <div className="flex flex-col gap-1">
          <label className="flex items-start gap-3 text-sm leading-5 text-ink">
            <input type="checkbox" name="consent" defaultChecked={Boolean(draft) || v?.consent === "on"} className="mt-0.5 size-5 shrink-0 accent-brand" />
            <span>J&apos;accepte que mes informations et mes vidéos soient transmises à {companyName} pour établir mon devis. Les vidéos sont supprimées automatiquement après traitement.</span>
          </label>
          {err("consent") && <p className="text-xs leading-4 text-danger-text">{err("consent")}</p>}
        </div>
      </fieldset>

      <SubmitButton size="lg" block pendingLabel="Enregistrement…">Continuer</SubmitButton>
    </form>
  );
}
