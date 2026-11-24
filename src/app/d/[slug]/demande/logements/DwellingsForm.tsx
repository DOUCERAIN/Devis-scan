"use client";

import { useActionState } from "react";
import { saveDwellings } from "../../actions";
import { idleState, type ActionState } from "@/lib/errors";
import { TextArea, TextField } from "@/components/ui/Field";
import { SubmitButton } from "@/components/forms/SubmitButton";
import { FormMessage } from "@/components/forms/FormMessage";
import { fieldProps } from "@/components/forms/useFormValues";
import { ChoiceGroup } from "@/components/customer/ChoiceGroup";
import type { Draft, DraftDwelling } from "@/lib/public-request/service";

const HOUSING = [
  { value: "apartment", label: "Appartement" },
  { value: "house", label: "Maison" },
  { value: "storage_unit", label: "Box / garde-meubles" },
  { value: "other", label: "Autre" },
] as const;

const ELEVATOR = [
  { value: "none", label: "Pas d'ascenseur" },
  { value: "small", label: "Petit ascenseur", hint: "1 à 3 personnes" },
  { value: "standard", label: "Ascenseur standard" },
  { value: "large", label: "Grand ascenseur", hint: "ou monte-charge" },
] as const;

function DwellingFieldset({ kind, title, address, d, state }: { kind: "origin" | "destination"; title: string; address: string; d?: DraftDwelling; state: ActionState }) {
  const f = (name: keyof DraftDwelling) => fieldProps(state, `${kind}.${name}`, d?.[name] as string | number | null);
  const choice = (name: "housing_type" | "elevator") => {
    const p = fieldProps(state, `${kind}.${name}`, d?.[name]);
    return { name: `${kind}.${name}`, defaultValue: p.defaultValue, error: p.error };
  };
  return (
    <fieldset className="flex flex-col gap-5 rounded-lg border border-border bg-surface p-4 sm:p-6">
      <legend className="px-1 text-lg leading-[26px] font-semibold">{title}</legend>
      <p className="-mt-2 text-sm text-ink-muted">{address}</p>
      <ChoiceGroup legend="Type de logement" options={HOUSING} {...choice("housing_type")} />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <TextField id={`${kind}-surface`} label="Surface (m²)" optional inputMode="numeric" {...f("surface_m2")} />
        <TextField id={`${kind}-rooms`} label="Nombre de pièces" optional inputMode="numeric" {...f("room_count")} />
        <TextField id={`${kind}-floor`} label="Étage" optional inputMode="numeric" help="0 = rez-de-chaussée" {...f("floor")} />
      </div>
      <ChoiceGroup legend="Ascenseur" options={ELEVATOR} {...choice("elevator")} />
      <TextField id={`${kind}-carrying`} label="Distance de portage (mètres)" optional inputMode="numeric"
        help="Distance approximative entre l'endroit où le camion peut stationner et l'entrée du logement." {...f("carrying_distance_m")} />
      <TextArea id={`${kind}-access`} label="Difficultés d'accès" optional rows={2}
        placeholder="Escalier étroit, couloir, porte basse, digicode…" {...f("access_notes")} />
      <TextArea id={`${kind}-parking`} label="Contraintes particulières" optional rows={2}
        placeholder="Stationnement difficile, rue piétonne, horaires imposés…" {...f("parking_notes")} />
    </fieldset>
  );
}

export function DwellingsForm({ slug, draft }: { slug: string; draft: Draft }) {
  const [state, action] = useActionState(saveDwellings, idleState);
  const label = (k: "origin" | "destination") => {
    const d = draft.dwellings[k];
    return [d?.address_line, [d?.postal_code, d?.city].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  };
  return (
    <form action={action} className="flex flex-col gap-6" noValidate>
      <input type="hidden" name="slug" value={slug} />
      <FormMessage state={state} />
      <DwellingFieldset kind="origin" title="Logement de départ" address={label("origin")} d={draft.dwellings.origin} state={state} />
      <DwellingFieldset kind="destination" title="Logement d'arrivée" address={label("destination")} d={draft.dwellings.destination} state={state} />
      <SubmitButton size="lg" block pendingLabel="Enregistrement…">Continuer</SubmitButton>
    </form>
  );
}
