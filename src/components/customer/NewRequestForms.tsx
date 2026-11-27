"use client";

import { FlaskConical, Plus, RotateCcw } from "lucide-react";
import { useFormStatus } from "react-dom";
import { startNewRequest, startSimulation } from "@/app/d/[slug]/actions";
import { buttonClasses } from "@/components/ui/Button";
import { cn } from "@/components/ui/cn";

function Submit({ children, pendingLabel, variant = "primary", block, testId }: { children: React.ReactNode; pendingLabel: string; variant?: "primary" | "secondary" | "tertiary"; block?: boolean; testId: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} data-testid={testId} className={cn(buttonClasses({ variant, size: "lg", block }), "sm:w-auto")}>
      {pending ? pendingLabel : children}
    </button>
  );
}

/** « Nouvelle demande de devis » : nouvelle demande vierge et indépendante ; l'ancienne est conservée. */
export function NewRequestButton({ slug, variant = "primary", block = true }: { slug: string; variant?: "primary" | "secondary"; block?: boolean }) {
  return (
    <form action={startNewRequest}>
      <input type="hidden" name="slug" value={slug} />
      <Submit variant={variant} block={block} pendingLabel="Préparation…" testId="new-request"><Plus aria-hidden className="size-4" />Nouvelle demande de devis</Submit>
    </form>
  );
}

/**
 * « Recommencer depuis le début » pendant une demande non envoyée : confirmation demandée, car la demande en
 * cours ne pourra plus être reprise sur cet appareil (elle n'est pas supprimée pour autant).
 */
export function RestartButton({ slug, label = "Recommencer depuis le début" }: { slug: string; label?: string }) {
  return (
    <form action={startNewRequest} onSubmit={(e) => {
      if (!window.confirm("Recommencer une demande vierge ? La demande en cours, non envoyée, ne pourra plus être reprise sur cet appareil.")) e.preventDefault();
    }}>
      <input type="hidden" name="slug" value={slug} />
      <Submit variant="tertiary" block pendingLabel="Préparation…" testId="restart-request"><RotateCcw aria-hidden className="size-4" />{label}</Submit>
    </form>
  );
}

/** « Nouvelle simulation » : visible seulement en démonstration ou en test (contrôlé côté serveur). */
export function SimulationButton({ slug }: { slug: string }) {
  return (
    <form action={startSimulation} className="flex flex-col gap-1">
      <input type="hidden" name="slug" value={slug} />
      <Submit variant="secondary" block pendingLabel="Préparation…" testId="new-simulation"><FlaskConical aria-hidden className="size-4" />Nouvelle simulation</Submit>
      <span className="text-xs text-ink-muted">Mode démonstration : la demande sera marquée « Simulation » chez le déménageur.</span>
    </form>
  );
}
