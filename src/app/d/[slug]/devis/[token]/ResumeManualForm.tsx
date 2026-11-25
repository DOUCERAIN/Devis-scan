"use client";

import { useActionState } from "react";
import { ClipboardList } from "lucide-react";
import { startManualInventory } from "./actions";
import { idleState } from "@/lib/errors";
import { SubmitButton } from "@/components/forms/SubmitButton";
import { FormMessage } from "@/components/forms/FormMessage";

export function ResumeManualForm({ slug, token }: { slug: string; token: string }) {
  const [state, action] = useActionState(startManualInventory, idleState);
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="token" value={token} />
      <FormMessage state={state} />
      <SubmitButton pendingLabel="Chargement…"><ClipboardList aria-hidden className="size-4" /> Compléter mon inventaire moi-même</SubmitButton>
    </form>
  );
}
