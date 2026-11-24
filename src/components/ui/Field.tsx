import type { ComponentProps, ReactNode } from "react";
import { cn } from "./cn";

type Props = ComponentProps<"input"> & { id: string; label: ReactNode; help?: ReactNode; error?: ReactNode; optional?: boolean };

/** Champ de formulaire : libellé, saisie, aide ou erreur (charte : FormField). */
export function TextField({ id, label, help, error, optional, className, ...input }: Props) {
  const describedBy = error ? `${id}-error` : help ? `${id}-help` : undefined;
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-sm leading-5 font-medium text-ink">
        {label}
        {optional && <span className="font-normal text-ink-muted"> (facultatif)</span>}
      </label>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cn(
          "h-12 w-full rounded-md border bg-surface px-3 text-base text-ink placeholder:text-ink-muted focus:border-brand focus:shadow-[0_0_0_3px_var(--ds-brand-soft-strong)] focus:outline-none sm:h-10 sm:text-[15px]",
          error ? "border-danger" : "border-border-input",
        )}
        {...input}
      />
      {error ? (
        <p id={`${id}-error`} className="text-xs leading-4 text-danger-text">{error}</p>
      ) : help ? (
        <p id={`${id}-help`} className="text-xs leading-4 text-ink-muted">{help}</p>
      ) : null}
    </div>
  );
}
