"use client";

import { useActionState } from "react";
import { signUp } from "../actions";
import { idleState } from "@/lib/errors";
import { TextField } from "@/components/ui/Field";
import { Alert } from "@/components/ui/Alert";
import { SubmitButton } from "@/components/forms/SubmitButton";
import { FormMessage } from "@/components/forms/FormMessage";
import { fieldProps } from "@/components/forms/useFormValues";

export function SignUpForm() {
  const [state, action] = useActionState(signUp, idleState);

  if (state.status === "success") {
    return <Alert tone="success" title="Vérifiez votre boîte mail">{state.message}</Alert>;
  }

  const terms = state.status === "error" ? state.fieldErrors?.acceptTerms : undefined;
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <FormMessage state={state} />
      <TextField id="fullName" label="Votre nom" autoComplete="name" required {...fieldProps(state, "fullName")} />
      <TextField id="email" type="email" label="Adresse e-mail professionnelle" autoComplete="email" required {...fieldProps(state, "email")} />
      <TextField
        id="password"
        type="password"
        label="Mot de passe"
        autoComplete="new-password"
        required
        help="Au moins 8 caractères, avec des lettres et des chiffres."
        {...fieldProps(state, "password")}
      />
      <div className="flex flex-col gap-1">
        <label className="flex items-start gap-2.5 text-sm leading-5 text-ink">
          <input type="checkbox" name="acceptTerms" className="mt-0.5 size-[18px] shrink-0 accent-brand" aria-invalid={terms ? true : undefined} />
          <span>J&apos;accepte que mes données soient utilisées pour créer et gérer mon compte professionnel.</span>
        </label>
        {terms && <p className="text-xs leading-4 text-danger-text">{terms}</p>}
      </div>
      <SubmitButton block size="lg" pendingLabel="Création du compte…">Créer mon compte</SubmitButton>
    </form>
  );
}
