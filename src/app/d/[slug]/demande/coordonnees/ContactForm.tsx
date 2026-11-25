"use client";

import { useActionState, useState } from "react";
import { Building2, ShieldCheck, User } from "lucide-react";
import { saveContact } from "../../actions";
import { idleState } from "@/lib/errors";
import { TextField } from "@/components/ui/Field";
import { SubmitButton } from "@/components/forms/SubmitButton";
import { FormMessage } from "@/components/forms/FormMessage";
import { fieldProps } from "@/components/forms/useFormValues";
import { cn } from "@/components/ui/cn";
import type { DraftCustomer } from "@/lib/public-request/service";

const PROFILES = [
  { value: "individual", label: "Particulier", icon: User },
  { value: "company", label: "Entreprise", icon: Building2 },
] as const;

/** Profil particulier ou entreprise : seuls les champs utiles au profil choisi sont affichés. */
export function ContactForm({ slug, companyName, customer }: { slug: string; companyName: string; customer: DraftCustomer | null }) {
  const [state, action] = useActionState(saveContact, idleState);
  const v = state.status === "error" ? state.values : undefined;
  const [type, setType] = useState<"individual" | "company">((v?.type as "individual" | "company") ?? customer?.type ?? "individual");
  const err = (k: string) => (state.status === "error" ? state.fieldErrors?.[k] : undefined);
  const privacy = v ? v.privacy === "on" : Boolean(customer?.privacy_accepted);
  const marketing = v ? v.marketing === "on" : Boolean(customer?.marketing_consent);
  const legacyFirst = customer && !customer.first_name ? customer.full_name.split(" ")[0] : undefined;
  const legacyLast = customer && !customer.last_name ? customer.full_name.split(" ").slice(1).join(" ") : undefined;

  return (
    <form action={action} className="flex flex-col gap-6" noValidate>
      <input type="hidden" name="slug" value={slug} />
      {/* Profil transmis par un champ caché : la réinitialisation du formulaire après une erreur ne le perd pas. */}
      <input type="hidden" name="type" value={type} />
      <FormMessage state={state} />

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium">Vous êtes</legend>
        <div className="grid grid-cols-2 gap-2">
          {PROFILES.map(({ value, label, icon: Icon }) => (
            <label key={value} className={cn("flex min-h-14 cursor-pointer items-center justify-center gap-2 rounded-md border bg-surface px-3 font-semibold",
              "has-[:checked]:border-brand has-[:checked]:bg-brand-soft has-[:checked]:text-brand-pressed has-[:checked]:shadow-[inset_0_0_0_1px_var(--ds-brand)]",
              "has-[:focus-visible]:shadow-[0_0_0_2px_var(--ds-surface),0_0_0_4px_var(--ds-brand)] border-border-input")}>
              <input type="radio" name="profile" value={value} checked={type === value} onChange={() => setType(value)} className="sr-only" />
              <Icon aria-hidden className="size-5" /> {label}
            </label>
          ))}
        </div>
      </fieldset>

      {type === "company" ? (
        <fieldset className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-4 sm:p-6">
          <legend className="px-1 text-lg leading-[26px] font-semibold">Votre entreprise</legend>
          <TextField id="company_name" label="Nom de l'entreprise" autoComplete="organization" {...fieldProps(state, "company_name", customer?.company_name)} />
          <TextField id="siret" label="SIRET" optional inputMode="numeric" help="14 chiffres, si vous le connaissez." {...fieldProps(state, "siret", customer?.siret)} />
        </fieldset>
      ) : null}

      <fieldset className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-4 sm:p-6">
        <legend className="px-1 text-lg leading-[26px] font-semibold">{type === "company" ? "Personne à contacter" : "Vos coordonnées"}</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField id="first_name" label="Prénom" autoComplete="given-name" {...fieldProps(state, "first_name", customer?.first_name ?? legacyFirst)} />
          <TextField id="last_name" label="Nom" autoComplete="family-name" {...fieldProps(state, "last_name", customer?.last_name ?? legacyLast)} />
        </div>
        <TextField id="email" type="email" label="E-mail" autoComplete="email" inputMode="email" help="Pour recevoir votre devis." {...fieldProps(state, "email", customer?.email)} />
        <TextField id="phone" type="tel" label="Téléphone" autoComplete="tel" inputMode="tel" help="Pour organiser le déménagement avec vous." {...fieldProps(state, "phone", customer?.phone)} />
      </fieldset>

      <section className="flex flex-col gap-3 rounded-lg border border-border bg-surface-subtle p-4 text-sm">
        <h2 className="flex items-center gap-2 font-semibold"><ShieldCheck aria-hidden className="size-5 text-brand" /> Vos données personnelles</h2>
        <p className="text-ink-secondary">
          Vos coordonnées, les informations sur votre déménagement, votre inventaire et, si vous filmez votre logement, vos vidéos sont transmis
          à {companyName} uniquement pour établir votre devis et organiser votre déménagement. Les vidéos sont supprimées automatiquement
          après un délai limité. Vous pouvez demander l&apos;accès à vos données, leur correction ou leur suppression auprès de {companyName}.
        </p>
        <div className="flex flex-col gap-1">
          <label className="flex items-start gap-3 leading-5 text-ink">
            <input type="checkbox" name="privacy" defaultChecked={privacy} className="mt-0.5 size-5 shrink-0 accent-brand" />
            <span>J&apos;accepte que mes informations soient utilisées par {companyName} pour établir mon devis. <span className="text-ink-muted">(obligatoire)</span></span>
          </label>
          {err("privacy") ? <p className="text-xs leading-4 text-danger-text">{err("privacy")}</p> : null}
        </div>
        <label className="flex items-start gap-3 leading-5 text-ink">
          <input type="checkbox" name="marketing" defaultChecked={marketing} className="mt-0.5 size-5 shrink-0 accent-brand" />
          <span>J&apos;accepte de recevoir des offres de {companyName}. <span className="text-ink-muted">(facultatif)</span></span>
        </label>
      </section>

      <SubmitButton size="lg" block pendingLabel="Enregistrement…">Continuer</SubmitButton>
    </form>
  );
}
