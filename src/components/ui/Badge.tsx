import type { ReactNode } from "react";
import { cn } from "./cn";

export type BadgeTone = "neutral" | "brand" | "success" | "warning" | "danger" | "duplicate";

const tones: Record<BadgeTone, { badge: string; dot: string }> = {
  neutral: { badge: "bg-surface-subtle text-ink-secondary", dot: "bg-ink-muted" },
  brand: { badge: "bg-brand-soft text-brand-pressed", dot: "bg-brand" },
  success: { badge: "bg-success-soft text-success-text", dot: "bg-success" },
  warning: { badge: "bg-warning-soft text-warning-text", dot: "bg-warning" },
  danger: { badge: "bg-danger-soft text-danger-text", dot: "bg-danger" },
  duplicate: { badge: "bg-duplicate-soft text-duplicate-text", dot: "bg-duplicate" },
};

type Props = { tone?: BadgeTone; dot?: boolean; icon?: ReactNode; children: ReactNode; className?: string };

/** Étiquette d'état en un ou deux mots (charte : StatusBadge). */
export function Badge({ tone = "neutral", dot, icon, children, className }: Props) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1 whitespace-nowrap rounded-full px-[9px] text-xs font-semibold tabular-nums [&_svg]:size-3.5",
        tones[tone].badge,
        className,
      )}
    >
      {dot && <span aria-hidden className={cn("size-1.5 rounded-full", tones[tone].dot)} />}
      {icon}
      {children}
    </span>
  );
}
