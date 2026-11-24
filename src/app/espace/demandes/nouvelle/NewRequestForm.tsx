"use client";

import { useActionState } from "react";
import { createManualRequest } from "../actions";
import { idleState, type ActionState } from "@/lib/errors";
import { SelectField, TextArea, TextField } from "@/components/ui/Field";
import { SubmitButton } from "@/components/forms/SubmitButton";
import { FormMessage } from "@/components/forms/FormMessage";
import { fieldProps } from "@/components/forms/useFormValues";
import { ELEVATOR_LABELS, HOUSING_LABELS } from "@/lib/requests/labels";

const housingOptions = Object.entries(HOUSING_LABELS).map(([value, label]) => ({ value, label }));
const elevatorOptions = Object.entries(ELEVATOR_LABELS).map(([value, label]) => ({ value, label }));

function DwellingFields({ prefix, title, state }: { prefix: "origin" | "destination"; title: string; state: ActionState }) {
  const f = (name: string) => fieldProps(state, `${prefix}.${name}`);
  return (
    <fieldset className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-4 sm:p-5">
      <legend className="px-1 text-lg leading-[26px] font-semibold">{title}</legend>
      <TextField id={`${prefix}-address`} label="Adresse" optional autoComplete="street-address" {...f("address_line")} />
      <div className="grid gap-4 sm:grid-cols-[160px_1fr]">
        <TextField id={`${prefix}-postal`} label="Code postal" optional inputMode="numeric" {...f("postal_code")} />
        <TextField id={`${prefix}-city`} label="Ville" required {...f("city")} />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <SelectField id={`${prefix}-housing`} label="Logement" optional options={housingOptions} placeholder="Non précisé" {...f("housing_type")} />
        <TextField id={`${prefix}-floor`} label="Étage" optional inputMode="numeric" help="0 = rez-de-chaussée" {...f("floor")} />
        <SelectField id={`${prefix}-elevator`} label="Ascenseur" optional options={elevatorOptions} placeholder="Non précisé" {...f("elevator")} />
      </div>
      <TextField id={`${prefix}-carrying`} label="Distance de portage (mètres)" optional inputMode="numeric"
        help="Distance entre le camion et l'entrée du logement." {...f("carrying_distance_m")} />
      <TextArea id={`${prefix}-access`} label="Remarques d'accès" optional rows={2}
        placeholder="Stationnement, escalier étroit, digicode…" {...f("access_notes")} />
    </fieldset>
  );
}

export function NewRequestForm() {
  const [state, action] = useActionState(createManualRequest, idleState);
  const flexible = state.status === "error" ? state.values?.moving_date_flexible === "on" : false;
  return (
    <form action={action} className="flex flex-col gap-6" noValidate>
      <FormMessage state={state} />
      <fieldset className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-4 sm:p-5">
        <legend className="px-1 text-lg leading-[26px] font-semibold">Client</legend>
        <TextField id="customer-name" label="Nom du client" required autoComplete="off" {...fieldProps(state, "customer.full_name")} />
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField id="customer-email" type="email" label="E-mail" optional autoComplete="off" {...fieldProps(state, "customer.email")} />
          <TextField id="customer-phone" type="tel" label="Téléphone" optional autoComplete="off" {...fieldProps(state, "customer.phone")} />
        </div>
        <div className="grid items-end gap-4 sm:grid-cols-2">
          <TextField id="moving-date" type="date" label="Date souhaitée" optional {...fieldProps(state, "moving_date")} />
          <label className="flex h-10 items-center gap-2.5 text-sm text-ink">
            <input type="checkbox" name="moving_date_flexible" defaultChecked={flexible} className="size-[18px] accent-brand" />
            Date flexible
          </label>
        </div>
        <TextArea id="customer-notes" label="Remarques du client" optional rows={3} {...fieldProps(state, "customer_notes")} />
      </fieldset>
      <div className="grid gap-6 lg:grid-cols-2">
        <DwellingFields prefix="origin" title="Départ" state={state} />
        <DwellingFields prefix="destination" title="Arrivée" state={state} />
      </div>
      <div className="flex justify-end">
        <SubmitButton size="lg" pendingLabel="Création…">Créer la demande</SubmitButton>
      </div>
    </form>
  );
}
