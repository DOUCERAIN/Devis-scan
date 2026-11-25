"use client";

import { useActionState } from "react";
import { ClipboardList, Video } from "lucide-react";
import { chooseMethod } from "../../actions";
import { idleState } from "@/lib/errors";
import { FormMessage } from "@/components/forms/FormMessage";
import { SubmitButton } from "@/components/forms/SubmitButton";
import { cn } from "@/components/ui/cn";

const METHODS = [
  {
    value: "video", icon: Video, title: "Filmer mon logement",
    text: "Une courte vidéo par pièce avec votre téléphone. L'inventaire est préparé automatiquement, puis vous le vérifiez.",
    hint: "Environ 1 minute par pièce",
  },
  {
    value: "manual", icon: ClipboardList, title: "Faire mon inventaire manuellement",
    text: "Choisissez vos meubles par pièce dans une liste, avec les quantités. Ajoutez librement les objets qui n'y sont pas.",
    hint: "Sans vidéo",
  },
] as const;

export function MethodForm({ slug, current, hasVideos, hasItems }: { slug: string; current: "video" | "manual" | null; hasVideos: boolean; hasItems: boolean }) {
  const [state, action] = useActionState(chooseMethod, idleState);
  return (
    <form action={action} className="flex flex-col gap-5" noValidate>
      <input type="hidden" name="slug" value={slug} />
      <FormMessage state={state} />
      <fieldset className="grid gap-3 sm:grid-cols-2">
        <legend className="sr-only">Méthode d&apos;inventaire</legend>
        {METHODS.map(({ value, icon: Icon, title, text, hint }) => (
          <label key={value} data-testid={`method-${value}`}
            className={cn("flex cursor-pointer flex-col gap-3 rounded-xl border-2 bg-surface p-5 transition-colors",
              "border-border hover:border-brand/50 has-[:checked]:border-brand has-[:checked]:bg-brand-soft/60",
              "has-[:focus-visible]:shadow-[0_0_0_2px_var(--ds-surface),0_0_0_4px_var(--ds-brand)]")}>
            <input type="radio" name="inventory_method" value={value} defaultChecked={current === value} className="sr-only" />
            <span className="flex size-12 items-center justify-center rounded-full bg-brand-soft text-brand"><Icon aria-hidden className="size-6" /></span>
            <span className="text-lg leading-[26px] font-bold">{title}</span>
            <span className="text-sm text-ink-secondary">{text}</span>
            <span className="text-xs font-medium text-brand">{hint}</span>
          </label>
        ))}
      </fieldset>
      {state.status === "error" && state.fieldErrors?.inventory_method ? <p className="text-sm text-danger-text">{state.fieldErrors.inventory_method}</p> : null}
      {hasVideos || hasItems ? (
        <p className="text-sm text-ink-secondary">
          Vous pouvez changer de méthode : {hasVideos ? "vos vidéos" : "votre inventaire"} déjà {hasVideos ? "envoyées sont conservées" : "saisi est conservé"} tant que la demande n&apos;est pas envoyée,
          mais seule la méthode choisie sera utilisée.
        </p>
      ) : null}
      <SubmitButton size="lg" block pendingLabel="Enregistrement…">Continuer</SubmitButton>
    </form>
  );
}
