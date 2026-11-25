"use client";

import { useActionState, useState } from "react";
import { CalendarPlus, X } from "lucide-react";
import { saveTrip } from "../../actions";
import { idleState, type ActionState } from "@/lib/errors";
import { SelectField, TextArea, TextField } from "@/components/ui/Field";
import { SubmitButton } from "@/components/forms/SubmitButton";
import { FormMessage } from "@/components/forms/FormMessage";
import { fieldProps } from "@/components/forms/useFormValues";
import { AddressField } from "@/components/customer/AddressField";
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

/** Étages proposés : sous-sols, rez-de-chaussée (0), puis 1er à 30e. */
const FLOORS = [
  { value: "-2", label: "2e sous-sol" },
  { value: "-1", label: "Sous-sol" },
  { value: "0", label: "Rez-de-chaussée" },
  ...Array.from({ length: 30 }, (_, i) => ({ value: String(i + 1), label: i === 0 ? "1er étage" : `${i + 1}e étage` })),
];

type Kind = "origin" | "destination";

function Place({ kind, title, d, state }: { kind: Kind; title: string; d?: DraftDwelling; state: ActionState }) {
  const v = state.status === "error" ? state.values : undefined;
  const err = (k: string) => (state.status === "error" ? state.fieldErrors?.[`${kind}.${k}`] : undefined);
  const f = (name: keyof DraftDwelling) => fieldProps(state, `${kind}.${name}`, d?.[name] as string | number | null);
  const choice = (name: "housing_type" | "elevator") => {
    const p = fieldProps(state, `${kind}.${name}`, d?.[name]);
    return { name: `${kind}.${name}`, defaultValue: p.defaultValue, error: p.error };
  };
  const floor = f("floor");
  const hasDetails = Boolean(d?.surface_m2 || d?.room_count || d?.carrying_distance_m || d?.access_notes || d?.parking_notes);
  return (
    <fieldset className="flex flex-col gap-5 rounded-lg border border-border bg-surface p-4 sm:p-6">
      <legend className="px-1 text-lg leading-[26px] font-semibold">{title}</legend>
      <AddressField
        prefix={kind}
        label={kind === "origin" ? "Adresse de départ" : "Adresse d'arrivée"}
        values={{
          address_line: v?.[`${kind}.address_line`] ?? d?.address_line,
          postal_code: v?.[`${kind}.postal_code`] ?? d?.postal_code,
          city: v?.[`${kind}.city`] ?? d?.city,
          latitude: v?.[`${kind}.latitude`] ?? d?.latitude,
          longitude: v?.[`${kind}.longitude`] ?? d?.longitude,
        }}
        errors={{ address_line: err("address_line"), postal_code: err("postal_code"), city: err("city") }}
      />
      <ChoiceGroup legend="Type de logement" options={HOUSING} {...choice("housing_type")} />
      {/* Clé liée à la valeur : après une erreur, la liste est recréée avec l'étage saisi (sinon la réinitialisation du formulaire le perdrait). */}
      <SelectField key={`floor-${floor.defaultValue ?? ""}`} id={`${kind}-floor`} name={`${kind}.floor`} label="Étage" options={FLOORS} placeholder="Choisir l'étage"
        help="Pour une maison, indiquez le niveau de l'entrée principale." defaultValue={floor.defaultValue ?? ""} error={floor.error} />
      <ChoiceGroup legend="Ascenseur" options={ELEVATOR} {...choice("elevator")} />
      <details className="group rounded-md border border-border bg-surface-subtle/50 p-3" open={hasDetails || undefined}>
        <summary className="cursor-pointer text-sm font-medium text-brand">Préciser l&apos;accès (facultatif)</summary>
        <div className="mt-4 flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <TextField id={`${kind}-surface`} label="Surface (m²)" optional inputMode="numeric" {...f("surface_m2")} />
            <TextField id={`${kind}-rooms`} label="Nombre de pièces" optional inputMode="numeric" {...f("room_count")} />
          </div>
          <TextField id={`${kind}-carrying`} label="Distance de portage (mètres)" optional inputMode="numeric"
            help="Entre l'endroit où le camion peut stationner et l'entrée du logement." {...f("carrying_distance_m")} />
          <TextArea id={`${kind}-access`} label="Difficultés d'accès" optional rows={2} placeholder="Escalier étroit, couloir, porte basse, digicode…" {...f("access_notes")} />
          <TextArea id={`${kind}-parking`} label="Contraintes particulières" optional rows={2} placeholder="Stationnement difficile, rue piétonne, horaires imposés…" {...f("parking_notes")} />
        </div>
      </details>
    </fieldset>
  );
}

let nextKey = 0;

export function TripForm({ slug, draft }: { slug: string; draft: Draft | null }) {
  const [state, action] = useActionState(saveTrip, idleState);
  const err = (k: string) => (state.status === "error" ? state.fieldErrors?.[k] : undefined);
  const initial = draft?.alternative_moving_dates?.length ? draft.alternative_moving_dates : [];
  const [dates, setDates] = useState(() => initial.map((value) => ({ key: nextKey++, value })));
  const today = new Date().toISOString().slice(0, 10);
  const v = state.status === "error" ? state.values : undefined;
  const flexible = v ? v.moving_date_flexible === "on" : draft?.moving_date_flexible;

  return (
    <form action={action} className="flex flex-col gap-6" noValidate>
      <input type="hidden" name="slug" value={slug} />
      <FormMessage state={state} />
      <Place kind="origin" title="Départ" d={draft?.dwellings.origin} state={state} />
      <Place kind="destination" title="Arrivée" d={draft?.dwellings.destination} state={state} />

      <fieldset className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-4 sm:p-6">
        <legend className="px-1 text-lg leading-[26px] font-semibold">Date du déménagement</legend>
        <TextField id="moving_date" type="date" label="Date souhaitée" min={today} {...fieldProps(state, "moving_date", draft?.moving_date)} />
        {dates.length > 0 ? (
          <ul className="flex flex-col gap-3" aria-label="Dates alternatives">
            {dates.map((d, i) => (
              <li key={d.key} className="flex items-end gap-2">
                <TextField id={`alt-${d.key}`} name="alternative_moving_dates" type="date" label={`Date alternative ${i + 1}`} optional min={today}
                  className="flex-1" defaultValue={d.value} error={err(`alternative_moving_dates.${i}`)}
                  onChange={(e) => { const value = e.currentTarget.value; setDates((all) => all.map((x) => (x.key === d.key ? { ...x, value } : x))); }} />
                <button type="button" onClick={() => setDates((all) => all.filter((x) => x.key !== d.key))}
                  className="mb-0.5 inline-flex size-12 shrink-0 items-center justify-center rounded-md border border-border-input text-ink-secondary hover:bg-surface-subtle sm:size-10"
                  aria-label={`Retirer la date alternative ${i + 1}`}>
                  <X aria-hidden className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        {err("alternative_moving_dates") ? <p className="text-xs text-danger-text">{err("alternative_moving_dates")}</p> : null}
        {dates.length < 30 ? (
          <button type="button" onClick={() => setDates((all) => [...all, { key: nextKey++, value: "" }])}
            className="inline-flex min-h-11 items-center gap-2 self-start rounded-md px-1 text-sm font-semibold text-brand hover:underline">
            <CalendarPlus aria-hidden className="size-4" /> Ajouter une date alternative
          </button>
        ) : null}
        <label className="flex min-h-11 items-center gap-3 text-sm text-ink">
          <input type="checkbox" name="moving_date_flexible" defaultChecked={Boolean(flexible)} className="size-5 accent-brand" />
          Mes dates sont flexibles de quelques jours
        </label>
      </fieldset>

      <SubmitButton size="lg" block pendingLabel="Enregistrement…">Continuer</SubmitButton>
    </form>
  );
}
