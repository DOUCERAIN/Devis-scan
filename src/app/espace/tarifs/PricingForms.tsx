"use client";

import { useActionState } from "react";
import { Trash2 } from "lucide-react";
import { addSurcharge, deleteOption, deleteSurcharge, saveOption, updatePricingSettings } from "./actions";
import { idleState } from "@/lib/errors";
import { SelectField, TextField } from "@/components/ui/Field";
import { SubmitButton } from "@/components/forms/SubmitButton";
import { FormMessage } from "@/components/forms/FormMessage";
import { fieldProps } from "@/components/forms/useFormValues";
import { PRICING_MODE_LABELS } from "@/lib/validation/pricing";
import type { Database } from "@/lib/supabase/database.types";

type Tables = Database["public"]["Tables"];
type Settings = Tables["pricing_settings"]["Row"];
type Option = Tables["pricing_options"]["Row"];
type Surcharge = Tables["pricing_item_surcharges"]["Row"];

const modeOptions = Object.entries(PRICING_MODE_LABELS).map(([value, label]) => ({ value, label }));
const euro = (n: number) => String(n).replace(".", ",");

export function PricingSettingsForm({ settings, disabled }: { settings: Settings; disabled: boolean }) {
  const [state, action] = useActionState(updatePricingSettings, idleState);
  const f = (name: keyof Settings) => fieldProps(state, name, typeof settings[name] === "number" ? euro(settings[name] as number) : (settings[name] as string));
  const group = "grid gap-4 sm:grid-cols-2 lg:grid-cols-3";
  return (
    <form action={action} className="flex flex-col gap-6" noValidate>
      <fieldset disabled={disabled} className="flex flex-col gap-6">
        <div className="flex flex-col gap-3">
          <h3 className="text-base font-semibold">Volume et minimum</h3>
          <div className={group}>
            <TextField id="price_per_m3" label="Prix au m³ (€ HT)" inputMode="decimal" {...f("price_per_m3")} />
            <TextField id="minimum_price" label="Prix minimum (€ HT)" inputMode="decimal" help="Montant plancher d'un devis." {...f("minimum_price")} />
            <TextField id="vat_rate" label="Taux de TVA (%)" inputMode="decimal" {...f("vat_rate")} />
          </div>
        </div>
        <div className="flex flex-col gap-3">
          <h3 className="text-base font-semibold">Déplacement</h3>
          <div className={group}>
            <TextField id="travel_fee" label="Frais de déplacement fixes (€ HT)" inputMode="decimal" {...f("travel_fee")} />
            <TextField id="included_distance_km" label="Distance incluse (km)" inputMode="numeric" {...f("included_distance_km")} />
            <TextField id="price_per_extra_km" label="Prix par km au-delà (€ HT)" inputMode="decimal" {...f("price_per_extra_km")} />
          </div>
        </div>
        <div className="flex flex-col gap-3">
          <h3 className="text-base font-semibold">Accès</h3>
          <div className={group}>
            <TextField id="floor_fee_without_elevator" label="Par étage sans ascenseur (€ HT)" inputMode="decimal" {...f("floor_fee_without_elevator")} />
            <TextField id="floor_fee_small_elevator" label="Par étage avec petit ascenseur (€ HT)" inputMode="decimal" {...f("floor_fee_small_elevator")} />
            <TextField id="heavy_item_fee" label="Objet lourd, par défaut (€ HT)" inputMode="decimal" {...f("heavy_item_fee")} />
            <TextField id="free_carrying_distance_m" label="Portage inclus (m)" inputMode="numeric" {...f("free_carrying_distance_m")} />
            <TextField id="carrying_fee_per_10m" label="Par 10 m de portage en plus (€ HT)" inputMode="decimal" {...f("carrying_fee_per_10m")} />
          </div>
        </div>
      </fieldset>
      <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center">
        <FormMessage state={state} className="sm:flex-1" />
        <SubmitButton disabled={disabled} className="sm:ml-auto">Enregistrer la grille</SubmitButton>
      </div>
    </form>
  );
}

export function OptionRow({ option, disabled }: { option: Option; disabled: boolean }) {
  const [state, action] = useActionState(saveOption, idleState);
  const [delState, delAction] = useActionState(deleteOption, idleState);
  const f = (name: keyof Option) => fieldProps(state, name, name === "price" ? euro(option.price) : (option[name] as string | null));
  return (
    <li className="flex flex-col gap-3 rounded-md border border-border p-4">
      <form action={action} className="flex flex-col gap-3" noValidate>
        <input type="hidden" name="id" value={option.id} />
        <fieldset disabled={disabled} className="grid gap-3 sm:grid-cols-[2fr_1fr_1fr]">
          <TextField id={`opt-name-${option.id}`} label="Nom" {...f("name")} />
          <SelectField id={`opt-mode-${option.id}`} label="Calcul" options={modeOptions} {...f("pricing_mode")} />
          <TextField id={`opt-price-${option.id}`} label="Prix (€ HT)" inputMode="decimal" {...f("price")} />
          <TextField id={`opt-desc-${option.id}`} label="Description" optional className="sm:col-span-3" {...f("description")} />
        </fieldset>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-ink-secondary">
            <input type="checkbox" name="is_active" defaultChecked={option.is_active} disabled={disabled} className="size-4 accent-brand" />
            Proposée aux clients
          </label>
          <div className="ml-auto flex items-center gap-2">
            <SubmitButton size="sm" variant="secondary" disabled={disabled}>Enregistrer</SubmitButton>
          </div>
        </div>
        <FormMessage state={state} />
      </form>
      {!disabled && (
        <form action={delAction} className="flex flex-col gap-2 border-t border-border pt-3">
          <input type="hidden" name="id" value={option.id} />
          <SubmitButton size="sm" variant="tertiary" className="self-start text-danger-text hover:bg-danger-soft" pendingLabel="Suppression…">
            <Trash2 aria-hidden />Supprimer cette option
          </SubmitButton>
          <FormMessage state={delState} />
        </form>
      )}
    </li>
  );
}

export function NewOptionForm() {
  const [state, action] = useActionState(saveOption, idleState);
  return (
    <form action={action} className="flex flex-col gap-3 rounded-md border border-dashed border-border-input p-4" noValidate>
      <p className="text-sm font-semibold">Ajouter une option</p>
      <div className="grid gap-3 sm:grid-cols-[2fr_1fr_1fr]">
        <TextField id="new-opt-name" label="Nom" placeholder="Ex. : Garde-meubles (par mois)" {...fieldProps(state, "name")} />
        <SelectField id="new-opt-mode" label="Calcul" options={modeOptions} {...fieldProps(state, "pricing_mode", "fixed")} />
        <TextField id="new-opt-price" label="Prix (€ HT)" inputMode="decimal" {...fieldProps(state, "price")} />
        <TextField id="new-opt-desc" label="Description" optional className="sm:col-span-3" {...fieldProps(state, "description")} />
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <FormMessage state={state} className="sm:flex-1" />
        <SubmitButton variant="secondary" className="sm:ml-auto" pendingLabel="Ajout…">Ajouter l&apos;option</SubmitButton>
      </div>
    </form>
  );
}

export function SurchargeList({ items, disabled }: { items: Surcharge[]; disabled: boolean }) {
  const [state, action] = useActionState(deleteSurcharge, idleState);
  if (items.length === 0) return <p className="text-sm text-ink-muted">Aucun supplément spécifique : le supplément « objet lourd » par défaut s&apos;applique.</p>;
  return (
    <div className="flex flex-col gap-2">
      <ul className="divide-y divide-border rounded-md border border-border">
        {items.map((item) => (
          <li key={item.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
            <span className="font-medium">{item.name}</span>
            <span className="ml-auto tabular-nums">{euro(item.surcharge)}&nbsp;€ HT</span>
            {!disabled && (
              <form action={action}>
                <input type="hidden" name="id" value={item.id} />
                <button type="submit" className="inline-grid size-8 place-items-center rounded-md text-ink-muted hover:bg-danger-soft hover:text-danger-text">
                  <Trash2 aria-hidden className="size-4" />
                  <span className="sr-only">Supprimer {item.name}</span>
                </button>
              </form>
            )}
          </li>
        ))}
      </ul>
      <FormMessage state={state} />
    </div>
  );
}

export function NewSurchargeForm() {
  const [state, action] = useActionState(addSurcharge, idleState);
  return (
    <form action={action} className="flex flex-col gap-3" noValidate>
      <div className="grid items-end gap-3 sm:grid-cols-[2fr_1fr_auto]">
        <TextField id="new-sur-name" label="Objet" placeholder="Ex. : Piano droit" {...fieldProps(state, "name")} />
        <TextField id="new-sur-amount" label="Supplément (€ HT)" inputMode="decimal" {...fieldProps(state, "surcharge")} />
        <SubmitButton variant="secondary" pendingLabel="Ajout…">Ajouter</SubmitButton>
      </div>
      <FormMessage state={state} />
    </form>
  );
}
