import { CircleCheck, CircleX, Info, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "./cn";

type Tone = "info" | "warning" | "success" | "danger";

const styles: Record<Tone, { box: string; icon: string; Icon: typeof Info }> = {
  info: { box: "border-brand-soft-strong bg-brand-soft", icon: "text-brand", Icon: Info },
  warning: { box: "border-transparent bg-warning-soft", icon: "text-warning", Icon: TriangleAlert },
  success: { box: "border-transparent bg-success-soft", icon: "text-success", Icon: CircleCheck },
  danger: { box: "border-transparent bg-danger-soft", icon: "text-danger", Icon: CircleX },
};

/** Bandeau d'information dans la page (charte : Alert). */
export function Alert({ tone = "info", title, children, className }: { tone?: Tone; title: ReactNode; children?: ReactNode; className?: string }) {
  const { box, icon, Icon } = styles[tone];
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={cn("flex items-start gap-3 rounded-md border px-3.5 py-3 text-sm leading-5 text-ink", box, className)}>
      <Icon aria-hidden className={cn("mt-px size-[18px] shrink-0", icon)} />
      <div>
        <p className="font-semibold">{title}</p>
        {children && <div className="mt-0.5">{children}</div>}
      </div>
    </div>
  );
}
