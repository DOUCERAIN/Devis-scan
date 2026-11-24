import type { ComponentProps, ReactNode } from "react";
import { cn } from "./cn";

const controlBase =
  "w-full rounded-md border bg-surface px-3 text-base text-ink placeholder:text-ink-muted focus:border-brand focus:shadow-[0_0_0_3px_var(--ds-brand-soft-strong)] focus:outline-none disabled:cursor-not-allowed disabled:bg-surface-subtle disabled:text-ink-secondary sm:text-[15px]";

type Common = { id: string; label: ReactNode; help?: ReactNode; error?: ReactNode; optional?: boolean; className?: string };

function FieldShell({ id, label, help, error, optional, className, children }: Common & { children: ReactNode }) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-sm leading-5 font-medium text-ink">
        {label}
        {optional && <span className="font-normal text-ink-muted"> (facultatif)</span>}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="text-xs leading-4 text-danger-text">{error}</p>
      ) : help ? (
        <p id={`${id}-help`} className="text-xs leading-4 text-ink-muted">{help}</p>
      ) : null}
    </div>
  );
}

function describedBy(id: string, error?: ReactNode, help?: ReactNode) {
  return error ? `${id}-error` : help ? `${id}-help` : undefined;
}

/** Champ de formulaire : libellé, saisie, aide ou erreur (charte : FormField). */
export function TextField({ id, label, help, error, optional, className, ...input }: Common & Omit<ComponentProps<"input">, "id">) {
  return (
    <FieldShell id={id} label={label} help={help} error={error} optional={optional} className={className}>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, error, help)}
        className={cn(controlBase, "h-12 sm:h-10", error ? "border-danger" : "border-border-input")}
        {...input}
      />
    </FieldShell>
  );
}

export function TextArea({ id, label, help, error, optional, className, rows = 4, ...input }: Common & Omit<ComponentProps<"textarea">, "id">) {
  return (
    <FieldShell id={id} label={label} help={help} error={error} optional={optional} className={className}>
      <textarea
        id={id}
        rows={rows}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, error, help)}
        className={cn(controlBase, "py-2.5 leading-6", error ? "border-danger" : "border-border-input")}
        {...input}
      />
    </FieldShell>
  );
}

export function SelectField({
  id, label, help, error, optional, className, options, placeholder, ...select
}: Common & Omit<ComponentProps<"select">, "id"> & { options: ReadonlyArray<{ value: string; label: string }>; placeholder?: string }) {
  return (
    <FieldShell id={id} label={label} help={help} error={error} optional={optional} className={className}>
      <select
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, error, help)}
        className={cn(controlBase, "h-12 sm:h-10", error ? "border-danger" : "border-border-input")}
        {...select}
      >
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </FieldShell>
  );
}
