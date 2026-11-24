"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signIn } from "../actions";
import { idleState } from "@/lib/errors";
import { TextField } from "@/components/ui/Field";
import { SubmitButton } from "@/components/forms/SubmitButton";
import { FormMessage } from "@/components/forms/FormMessage";
import { fieldProps } from "@/components/forms/useFormValues";

export function LoginForm({ next }: { next?: string }) {
  const [state, action] = useActionState(signIn, idleState);
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <FormMessage state={state} />
      {next && <input type="hidden" name="suivant" value={next} />}
      <TextField id="email" type="email" label="Adresse e-mail" autoComplete="email" required {...fieldProps(state, "email")} />
      <TextField id="password" type="password" label="Mot de passe" autoComplete="current-password" required {...fieldProps(state, "password")} />
      <div className="-mt-1 text-right">
        <Link href="/mot-de-passe-oublie" className="text-sm font-medium text-brand hover:underline">Mot de passe oublié ?</Link>
      </div>
      <SubmitButton block size="lg" pendingLabel="Connexion…">Se connecter</SubmitButton>
    </form>
  );
}
