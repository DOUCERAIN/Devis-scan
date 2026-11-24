"use client";

import { useActionState } from "react";
import { updatePassword } from "../actions";
import { idleState } from "@/lib/errors";
import { TextField } from "@/components/ui/Field";
import { SubmitButton } from "@/components/forms/SubmitButton";
import { FormMessage } from "@/components/forms/FormMessage";
import { fieldProps } from "@/components/forms/useFormValues";

export function NewPasswordForm() {
  const [state, action] = useActionState(updatePassword, idleState);
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <FormMessage state={state} />
      <TextField id="password" type="password" label="Nouveau mot de passe" autoComplete="new-password" required
        help="Au moins 8 caractères, avec des lettres et des chiffres." {...fieldProps(state, "password")} />
      <TextField id="confirmPassword" type="password" label="Confirmez le mot de passe" autoComplete="new-password" required
        {...fieldProps(state, "confirmPassword")} />
      <SubmitButton block size="lg" pendingLabel="Enregistrement…">Enregistrer le mot de passe</SubmitButton>
    </form>
  );
}
