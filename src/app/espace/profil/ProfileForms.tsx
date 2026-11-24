"use client";

import { useActionState } from "react";
import { changePassword, updateProfile } from "./actions";
import { idleState } from "@/lib/errors";
import { TextField } from "@/components/ui/Field";
import { SubmitButton } from "@/components/forms/SubmitButton";
import { FormMessage } from "@/components/forms/FormMessage";
import { fieldProps } from "@/components/forms/useFormValues";

export function ProfileForm({ fullName, phone, email }: { fullName: string | null; phone: string | null; email: string | null }) {
  const [state, action] = useActionState(updateProfile, idleState);
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField id="full_name" label="Nom complet" autoComplete="name" {...fieldProps(state, "full_name", fullName)} />
        <TextField id="phone" type="tel" label="Téléphone" optional autoComplete="tel" {...fieldProps(state, "phone", phone)} />
        <TextField id="email" type="email" label="Adresse e-mail de connexion" value={email ?? ""} readOnly disabled
          help="Pour changer d'adresse e-mail, contactez le support." className="sm:col-span-2" />
      </div>
      <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center">
        <FormMessage state={state} className="sm:flex-1" />
        <SubmitButton className="sm:ml-auto">Enregistrer le profil</SubmitButton>
      </div>
    </form>
  );
}

export function PasswordForm() {
  const [state, action] = useActionState(changePassword, idleState);
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-3">
        <TextField id="currentPassword" type="password" label="Mot de passe actuel" autoComplete="current-password" {...fieldProps(state, "currentPassword")} />
        <TextField id="password" type="password" label="Nouveau mot de passe" autoComplete="new-password"
          help="8 caractères minimum, lettres et chiffres." {...fieldProps(state, "password")} />
        <TextField id="confirmPassword" type="password" label="Confirmation" autoComplete="new-password" {...fieldProps(state, "confirmPassword")} />
      </div>
      <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center">
        <FormMessage state={state} className="sm:flex-1" />
        <SubmitButton variant="secondary" className="sm:ml-auto">Changer le mot de passe</SubmitButton>
      </div>
    </form>
  );
}
