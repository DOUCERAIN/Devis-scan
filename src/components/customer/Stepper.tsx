import Link from "next/link";
import { Check } from "lucide-react";
import { STEPS, stepHref, stepIndex, type InventoryMethod, type StepKey } from "@/lib/public-request/steps";
import { cn } from "@/components/ui/cn";

/** Indicateur de progression du parcours : étapes nommées, étape en cours, étapes déjà faites cliquables. */
export function Stepper({ slug, current, reachable, method }: { slug: string; current: StepKey; reachable: number; method?: InventoryMethod }) {
  const index = stepIndex(current);
  return (
    <nav aria-label="Progression de votre demande" className="flex flex-col gap-3">
      <p className="text-sm font-medium text-ink-secondary">
        Étape {index + 1} sur {STEPS.length} · <span className="font-semibold text-ink">{STEPS[index].label}</span>
      </p>
      <ol className="grid grid-cols-5 gap-1.5">
        {STEPS.map((step, i) => {
          const done = i < index;
          const canGo = i <= reachable && i !== index;
          const body = (
            <>
              <span className={cn("block h-1.5 rounded-full", i <= index ? "bg-brand" : "bg-surface-subtle")} />
              <span className={cn("mt-1.5 hidden truncate text-xs sm:block", i === index ? "font-semibold text-ink" : "text-ink-muted")}>
                {step.label}
              </span>
              <span className="sr-only">{done ? " (terminée)" : i === index ? " (en cours)" : ""}</span>
            </>
          );
          return (
            <li key={step.key}>
              {canGo ? (
                <Link href={stepHref(slug, step.key, method)} className="block py-1" title={step.label}>{body}</Link>
              ) : (
                <span aria-current={i === index ? "step" : undefined} className="block py-1">{body}</span>
              )}
            </li>
          );
        })}
      </ol>
      {index > 0 && (
        <Link href={stepHref(slug, STEPS[index - 1].key, method)} className="inline-flex items-center gap-1 self-start text-sm font-medium text-brand hover:underline">
          ← Étape précédente
        </Link>
      )}
    </nav>
  );
}

export function StepTitle({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <h1 className="text-[26px] leading-[34px] font-bold">{title}</h1>
      {children && <p className="text-ink-secondary">{children}</p>}
    </div>
  );
}

export function DoneMark() {
  return <Check aria-hidden className="size-4" />;
}
