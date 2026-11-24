import Link from "next/link";
import { Check } from "lucide-react";
import { STEPS, stepHref, stepIndex, type StepKey } from "@/lib/public-request/steps";
import { cn } from "@/components/ui/cn";

/** Indicateur de progression du parcours : étape en cours, étapes déjà faites cliquables. */
export function Stepper({ slug, current, reachable }: { slug: string; current: StepKey; reachable: number }) {
  const index = stepIndex(current);
  return (
    <nav aria-label="Progression de votre demande" className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm font-medium text-ink-secondary">
          Étape {index + 1} sur {STEPS.length}
        </p>
        <p className="text-sm font-semibold text-ink">{STEPS[index].label}</p>
      </div>
      <ol className="grid grid-cols-5 gap-1.5">
        {STEPS.map((step, i) => {
          const done = i < index;
          const canGo = i <= reachable && i !== index;
          const bar = (
            <span className={cn("block h-1.5 rounded-full", i <= index ? "bg-brand" : "bg-surface-subtle")}>
              <span className="sr-only">
                {step.label} {done ? "(terminée)" : i === index ? "(en cours)" : ""}
              </span>
            </span>
          );
          return (
            <li key={step.key}>
              {canGo ? (
                <Link href={stepHref(slug, step.key)} className="block py-2" title={step.label}>{bar}</Link>
              ) : (
                <span aria-current={i === index ? "step" : undefined} className="block py-2">{bar}</span>
              )}
            </li>
          );
        })}
      </ol>
      {index > 0 && (
        <Link href={stepHref(slug, STEPS[index - 1].key)} className="inline-flex items-center gap-1 self-start text-sm font-medium text-brand hover:underline">
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
