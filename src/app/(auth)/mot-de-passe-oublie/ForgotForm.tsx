"use client";

import { useActionState } from "react";
import { requestPasswordReset } from "../actions";
import { idleState } from "@/lib/errors";
import { TextField } from "@/components/ui/Field";
import { Alert } from "@/components/ui/Alert";
import { SubmitButton } from "@/components/forms/SubmitButton";
import { FormMessage } from "@/components/forms/FormMessage";
import { fieldProps } from "@/components/forms/useFormValues";

export function ForgotForm() {
  const [state, action] = useActionState(requestPasswordReset, idleState);
  if (state.status === "success") return <Alert tone="success" title="E-mail envoyé">{state.message}</Alert>;
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <FormMessage state={state} />
      <TextField id="email" type="email" label="Adresse e-mail" autoComplete="email" required {...fieldProps(state, "email")} />
      <SubmitButton block size="lg" pendingLabel="Envoi…">Recevoir le lien</SubmitButton>
    </form>
  );
}
