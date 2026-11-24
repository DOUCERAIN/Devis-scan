"use client";

import { useFormStatus } from "react-dom";
import type { ReactNode } from "react";
import { buttonClasses } from "@/components/ui/Button";

type Props = {
  children: ReactNode;
  pendingLabel?: string;
  variant?: "primary" | "secondary" | "tertiary" | "danger";
  size?: "sm" | "md" | "lg";
  block?: boolean;
  disabled?: boolean;
  className?: string;
  name?: string;
  value?: string;
};

/** Bouton d'envoi qui se désactive et l'indique pendant le traitement. */
export function SubmitButton({ children, pendingLabel = "Enregistrement…", variant, size, block, disabled, className, name, value }: Props) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      name={name}
      value={value}
      disabled={pending || disabled}
      aria-disabled={pending || disabled}
      className={buttonClasses({ variant, size, block, className })}
    >
      {pending ? pendingLabel : children}
    </button>
  );
}
