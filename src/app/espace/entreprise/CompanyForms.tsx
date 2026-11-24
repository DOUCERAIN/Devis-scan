"use client";

import { useActionState, useState } from "react";
import { updateBranding, updateCompanyProfile, updateQuoteSettings } from "./actions";
import { idleState } from "@/lib/errors";
import { TextArea, TextField } from "@/components/ui/Field";
import { SubmitButton } from "@/components/forms/SubmitButton";
import { FormMessage } from "@/components/forms/FormMessage";
import { fieldProps } from "@/components/forms/useFormValues";
import { accessibleBrandColor, contrastWithWhite, isValidHex } from "@/lib/company/color";
import type { Company } from "@/lib/auth/dal";

type Props = { company: Company; disabled: boolean };

function Footer({ state, disabled, label }: { state: Parameters<typeof FormMessage>[0]["state"]; disabled: boolean; label: string }) {
  return (
    <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
      <FormMessage state={state} className="sm:flex-1" />
      <SubmitButton disabled={disabled} className="sm:ml-auto">{label}</SubmitButton>
    </div>
  );
}

export function CompanyProfileForm({ company, disabled }: Props) {
  const [state, action] = useActionState(updateCompanyProfile, idleState);
  const f = (name: keyof Company) => fieldProps(state, name, company[name] as string | null);
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <fieldset disabled={disabled} className="grid gap-4 sm:grid-cols-2">
        <TextField id="name" label="Nom commercial" required className="sm:col-span-2" {...f("name")} />
        <TextField id="email" type="email" label="E-mail de contact" optional {...f("email")} />
        <TextField id="phone" type="tel" label="Téléphone" optional {...f("phone")} />
        <TextField id="website" label="Site Internet" optional placeholder="www.exemple.fr" className="sm:col-span-2" {...f("website")} />
        <TextField id="address_line1" label="Adresse" optional className="sm:col-span-2" {...f("address_line1")} />
        <TextField id="address_line2" label="Complément d'adresse" optional className="sm:col-span-2" {...f("address_line2")} />
        <TextField id="postal_code" label="Code postal" optional inputMode="numeric" {...f("postal_code")} />
        <TextField id="city" label="Ville" optional {...f("city")} />
        <TextField id="legal_name" label="Raison sociale" optional help="Si elle diffère du nom commercial." {...f("legal_name")} />
        <TextField id="siret" label="SIRET" optional inputMode="numeric" {...f("siret")} />
        <TextField id="vat_number" label="N° de TVA intracommunautaire" optional {...f("vat_number")} />
      </fieldset>
      <Footer state={state} disabled={disabled} label="Enregistrer les informations" />
    </form>
  );
}

export function BrandingForm({ company, disabled, logoUrl }: Props & { logoUrl: string | null }) {
  const [state, action] = useActionState(updateBranding, idleState);
  const [color, setColor] = useState(company.brand_color ?? "#3050c8");
  const [useDefault, setUseDefault] = useState(!company.brand_color);
  const effective = useDefault ? "#3050c8" : color;
  const adjusted = isValidHex(effective) ? accessibleBrandColor(effective) : "#3050c8";
  const tooLight = isValidHex(effective) && contrastWithWhite(effective) < 4.5;
  const logoError = state.status === "error" ? state.fieldErrors?.logo : undefined;
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <fieldset disabled={disabled} className="grid gap-6 sm:grid-cols-2">
        <div className="flex flex-col gap-3">
          <span className="text-sm leading-5 font-medium">Logo</span>
          <div className="flex items-center gap-4">
            <div className="grid size-16 place-items-center overflow-hidden rounded-md border border-border bg-canvas">
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoUrl} alt="Logo actuel" className="size-full object-contain" />
              ) : (
                <span className="text-xs text-ink-muted">Aucun</span>
              )}
            </div>
            <div className="flex min-w-0 flex-col gap-1.5">
              <input id="logo" name="logo" type="file" accept="image/png,image/jpeg,image/webp"
                aria-invalid={logoError ? true : undefined}
                className="block w-full text-sm text-ink-secondary file:mr-3 file:h-9 file:rounded-md file:border file:border-border-input file:bg-surface file:px-3 file:text-sm file:font-medium file:text-ink hover:file:bg-surface-subtle" />
              <span className="text-xs text-ink-muted">PNG, JPEG ou WebP, 2 Mo maximum.</span>
              {logoError && <span className="text-xs text-danger-text">{logoError}</span>}
            </div>
          </div>
          {logoUrl && (
            <label className="flex items-center gap-2 text-sm text-ink-secondary">
              <input type="checkbox" name="remove_logo" className="size-4 accent-brand" />Retirer le logo
            </label>
          )}
        </div>
        <div className="flex flex-col gap-3">
          <label htmlFor="brand_color" className="text-sm leading-5 font-medium">Couleur principale</label>
          <div className="flex items-center gap-3">
            <input id="brand_color" name="brand_color" type="color" value={color} disabled={useDefault}
              onChange={(e) => setColor(e.target.value)} className="h-10 w-14 cursor-pointer rounded-md border border-border-input bg-surface p-1 disabled:cursor-not-allowed disabled:opacity-50" />
            <span className="font-mono text-sm text-ink-secondary">{useDefault ? "Bleu Devis Scan" : color}</span>
          </div>
          <label className="flex items-center gap-2 text-sm text-ink-secondary">
            <input type="checkbox" name="use_default_color" checked={useDefault} onChange={(e) => setUseDefault(e.target.checked)} className="size-4 accent-brand" />
            Utiliser la couleur par défaut
          </label>
          <div className="flex items-center gap-3 rounded-md bg-canvas p-3">
            <span className="inline-flex h-10 items-center rounded-md px-4 text-sm font-semibold text-white" style={{ background: adjusted }}>
              Demander un devis
            </span>
            <span className="text-xs text-ink-muted">Aperçu du bouton vu par vos clients</span>
          </div>
          {tooLight && (
            <p className="text-xs text-warning-text">Cette couleur est trop claire pour du texte blanc : elle sera foncée automatiquement sur les boutons.</p>
          )}
        </div>
      </fieldset>
      <Footer state={state} disabled={disabled} label="Enregistrer l'identité visuelle" />
    </form>
  );
}

export function QuoteSettingsForm({ company, disabled }: Props) {
  const [state, action] = useActionState(updateQuoteSettings, idleState);
  const f = (name: keyof Company) => fieldProps(state, name, company[name] as string | number | null);
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <fieldset disabled={disabled} className="grid gap-4 sm:grid-cols-2">
        <TextField id="quote_validity_days" label="Validité des devis (jours)" inputMode="numeric" required {...f("quote_validity_days")} />
        <TextField id="video_retention_days" label="Conservation des vidéos (jours)" inputMode="numeric" required
          help="Entre 7 et 365 jours. Les vidéos sont ensuite supprimées définitivement." {...f("video_retention_days")} />
        <TextArea id="payment_terms" label="Conditions de paiement" optional rows={2} className="sm:col-span-2"
          placeholder="Ex. : acompte de 30 % à la signature, solde à la livraison." {...f("payment_terms")} />
        <TextArea id="insurance_info" label="Assurance" optional rows={2} className="sm:col-span-2"
          placeholder="Assureur, numéro de contrat, valeur garantie…" {...f("insurance_info")} />
        <TextArea id="reserves_terms" label="Réserves à la livraison" optional rows={3} className="sm:col-span-2"
          help="Votre procédure (délais, forme des réserves). Rédigée par vous : Devis Scan n'ajoute aucune clause." {...f("reserves_terms")} />
        <TextArea id="liability_terms" label="Responsabilité et garanties" optional rows={3} className="sm:col-span-2"
          help="Limites de responsabilité, déclaration de valeur…" {...f("liability_terms")} />
        <TextArea id="quote_terms" label="Conditions commerciales" optional rows={6} className="sm:col-span-2"
          help="Reproduites sur chaque devis." {...f("quote_terms")} />
      </fieldset>
      <Footer state={state} disabled={disabled} label="Enregistrer les paramètres" />
    </form>
  );
}
