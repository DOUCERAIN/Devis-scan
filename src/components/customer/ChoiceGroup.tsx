import { cn } from "@/components/ui/cn";

type Option = { value: string; label: string; hint?: string };

/** Choix unique en grandes cartes tactiles (boutons radio accessibles). */
export function ChoiceGroup({
  name, legend, options, defaultValue, error, columns = 2,
}: { name: string; legend: string; options: readonly Option[]; defaultValue?: string; error?: string; columns?: 2 | 3 | 4 }) {
  const id = name.replace(/\W/g, "-");
  return (
    <fieldset className="flex flex-col gap-2" aria-describedby={error ? `${id}-error` : undefined}>
      <legend className="mb-1 text-sm leading-5 font-medium text-ink">{legend}</legend>
      <div className={cn("grid gap-2", columns === 2 ? "grid-cols-2" : columns === 3 ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-2 sm:grid-cols-4")}>
        {options.map((o) => (
          <label
            key={o.value}
            className={cn(
              "flex min-h-12 cursor-pointer flex-col justify-center rounded-md border bg-surface px-3 py-2 text-sm font-medium text-ink",
              "has-[:checked]:border-brand has-[:checked]:bg-brand-soft has-[:checked]:text-brand-pressed has-[:checked]:shadow-[inset_0_0_0_1px_var(--ds-brand)]",
              "has-[:focus-visible]:shadow-[0_0_0_2px_var(--ds-surface),0_0_0_4px_var(--ds-brand)]",
              error ? "border-danger" : "border-border-input",
            )}
          >
            <input type="radio" name={name} value={o.value} defaultChecked={defaultValue === o.value} className="sr-only" />
            {o.label}
            {o.hint && <span className="text-xs font-normal text-ink-muted">{o.hint}</span>}
          </label>
        ))}
      </div>
      {error && <p id={`${id}-error`} className="text-xs leading-4 text-danger-text">{error}</p>}
    </fieldset>
  );
}
