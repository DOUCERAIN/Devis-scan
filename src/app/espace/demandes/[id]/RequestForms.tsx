"use client";

import { useActionState } from "react";
import { changeRequestStatus, updateInternalNotes } from "../actions";
import { idleState } from "@/lib/errors";
import { SelectField, TextArea } from "@/components/ui/Field";
import { SubmitButton } from "@/components/forms/SubmitButton";
import { FormMessage } from "@/components/forms/FormMessage";
import { MANUAL_STATUSES, STATUS_META, type RequestStatus } from "@/lib/requests/status";

export function StatusForm({ id, status }: { id: string; status: RequestStatus }) {
  const [state, action] = useActionState(changeRequestStatus, idleState);
  const options = MANUAL_STATUSES.map((s) => ({ value: s, label: STATUS_META[s].label }));
  const current = MANUAL_STATUSES.includes(status) ? status : undefined;
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="id" value={id} />
      <div className="flex flex-wrap items-end gap-3">
        <SelectField id="status" name="status" label="Statut de la demande" defaultValue={current} options={options}
          placeholder={current ? undefined : STATUS_META[status].label} className="min-w-[200px] flex-1" />
        <SubmitButton variant="secondary" pendingLabel="Mise à jour…">Mettre à jour</SubmitButton>
      </div>
      <FormMessage state={state} />
    </form>
  );
}

export function NotesForm({ id, notes }: { id: string; notes: string | null }) {
  const [state, action] = useActionState(updateInternalNotes, idleState);
  const value = state.status === "error" ? state.values?.internal_notes : notes ?? undefined;
  const error = state.status === "error" ? state.fieldErrors?.internal_notes : undefined;
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="id" value={id} />
      <TextArea id="internal_notes" name="internal_notes" label="Notes internes" defaultValue={value} error={error} rows={4}
        help="Visibles uniquement par votre équipe." />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <FormMessage state={state} className="flex-1" />
        <SubmitButton variant="secondary" pendingLabel="Enregistrement…">Enregistrer les notes</SubmitButton>
      </div>
    </form>
  );
}
