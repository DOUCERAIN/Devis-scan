"use client";

import { useActionState } from "react";
import { createCompany } from "../actions";
import { idleState } from "@/lib/errors";
import { TextField } from "@/components/ui/Field";
import { SubmitButton } from "@/components/forms/SubmitButton";
import { FormMessage } from "@/components/forms/FormMessage";
import { fieldProps } from "@/components/forms/useFormValues";

export function CreateCompanyForm() {
  const [state, action] = useActionState(createCompany, idleState);
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <FormMessage state={state} />
      <TextField id="name" label="Nom commercial de votre entreprise" placeholder="Ex. : Déménagements Martin" required
        help="C'est le nom que verront vos clients. Vous pourrez le modifier ensuite." {...fieldProps(state, "name")} />
      <SubmitButton size="lg" block pendingLabel="Création…">Créer mon espace entreprise</SubmitButton>
    </form>
  );
}
