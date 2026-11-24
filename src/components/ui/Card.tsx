import type { ReactNode } from "react";
import { cn } from "./cn";

/** Bloc de contenu de base (charte : Card). Pas de carte dans une carte. */
export function Card({ children, className, as: Tag = "div" }: { children: ReactNode; className?: string; as?: "div" | "section" | "article" }) {
  return (
    <Tag className={cn("flex min-w-0 flex-col gap-4 rounded-lg border border-border bg-surface p-4 sm:p-5", className)}>
      {children}
    </Tag>
  );
}

export function CardHeader({ title, action }: { title: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h3 className="text-lg leading-[26px] font-semibold text-ink">{title}</h3>
      {action}
    </div>
  );
}
