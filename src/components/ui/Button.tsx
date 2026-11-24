import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "./cn";

type Variant = "primary" | "secondary" | "tertiary" | "danger";
type Size = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md border font-medium transition-colors disabled:cursor-not-allowed disabled:border-border disabled:bg-surface-subtle disabled:text-ink-disabled disabled:shadow-none [&_svg]:size-[18px] [&_svg]:shrink-0";

const variants: Record<Variant, string> = {
  primary: "border-transparent bg-brand font-semibold text-on-brand hover:bg-brand-hover active:bg-brand-pressed",
  secondary: "border-border-input bg-surface text-ink shadow-sm hover:bg-surface-subtle",
  tertiary: "border-transparent bg-transparent px-2.5 text-brand hover:bg-brand-soft",
  danger: "border-danger bg-surface text-danger-text hover:bg-danger-soft",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-[13px] leading-5",
  md: "h-10 px-4 text-sm leading-5",
  lg: "h-12 px-[22px] text-base leading-6",
};

type Common = { variant?: Variant; size?: Size; block?: boolean; children: ReactNode; className?: string };

export function buttonClasses({ variant = "primary", size = "md", block, className }: Omit<Common, "children">) {
  return cn(base, sizes[size], variants[variant], block && "w-full", className);
}

/** Bouton d'action. Un seul `primary` par écran (charte : Button). */
export function Button({ variant, size, block, className, children, type = "button", ...rest }: Common & ComponentProps<"button">) {
  return (
    <button type={type} className={buttonClasses({ variant, size, block, className })} {...rest}>
      {children}
    </button>
  );
}

/** Lien présenté comme un bouton. */
export function ButtonLink({ variant, size, block, className, children, href, ...rest }: Common & ComponentProps<typeof Link>) {
  return (
    <Link href={href} className={buttonClasses({ variant, size, block, className })} {...rest}>
      {children}
    </Link>
  );
}
