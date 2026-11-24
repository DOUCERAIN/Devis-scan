import type { ReactNode } from "react";

/** Ce qu'affiche une liste vide (charte : EmptyState). */
export function EmptyState({ icon, title, children, action }: { icon: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border-input bg-surface px-6 py-10 text-center">
      <span aria-hidden className="grid size-11 place-items-center rounded-full bg-brand-soft text-brand [&_svg]:size-5">{icon}</span>
      <h2 className="text-lg leading-[26px] font-semibold">{title}</h2>
      {children && <div className="max-w-[44ch] text-sm leading-5 text-ink-secondary">{children}</div>}
      {action}
    </div>
  );
}
