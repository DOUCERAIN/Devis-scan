"use client";

import { useId, useRef, useState } from "react";
import { parseQuantityInput } from "@/lib/inventory/rooms";
import { cn } from "@/components/ui/cn";

/**
 * Quantité modifiable directement au clavier : un appui sur le nombre permet de le remplacer (clavier
 * numérique sur téléphone). Seuls les chiffres sont acceptés (ni signe, ni décimale, ni texte) ; le champ peut
 * rester vide pendant la saisie. Chaque nombre valide (1 ou plus) est appliqué tout de suite ; 0 retire
 * l'objet et un champ vide restaure l'ancienne valeur, à la sortie du champ (ou avec Entrée).
 */
export function QuantityInput({ value, onCommit, label, min = 0, max = 999, className, testId = "quantity-input" }: {
  value: number;
  onCommit: (value: number) => void;
  label: string;
  min?: number;
  max?: number;
  className?: string;
  testId?: string;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const cancelled = useRef(false);
  const errorId = useId();
  const shown = draft ?? String(value);

  function change(raw: string) {
    const digits = raw.replace(/[^0-9]/g, "");
    setError(digits !== raw ? "Chiffres uniquement (pas de signe ni de virgule)." : null);
    setDraft(digits);
    const parsed = parseQuantityInput(digits, max);
    if (parsed.ok && parsed.value !== null && parsed.value >= Math.max(1, min) && parsed.value !== value) onCommit(parsed.value);
    if (!parsed.ok) setError(parsed.message);
  }

  function finish() {
    if (cancelled.current) {
      cancelled.current = false;
      setDraft(null);
      setError(null);
      return;
    }
    const parsed = parseQuantityInput(draft ?? String(value), max);
    if (parsed.ok && parsed.value !== null && parsed.value >= min && parsed.value !== value) onCommit(parsed.value);
    setDraft(null);
    setError(null);
  }

  return (
    <span className={cn("relative inline-flex flex-col items-center", className)}>
      <input
        ref={input}
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete="off"
        enterKeyHint="done"
        aria-label={label}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        data-testid={testId}
        value={shown}
        onFocus={(e) => { setDraft(String(value)); e.currentTarget.select(); }}
        onChange={(e) => change(e.currentTarget.value)}
        onBlur={finish}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") {
            cancelled.current = true;
            e.currentTarget.blur();
          }
        }}
        className={cn(
          "h-11 w-14 rounded-md border bg-surface text-center text-base font-semibold tabular-nums sm:h-9 sm:w-12 sm:text-[15px]",
          "focus:border-brand focus:shadow-[0_0_0_3px_var(--ds-brand-soft-strong)] focus:outline-none",
          error ? "border-danger" : "border-transparent hover:border-border-input",
        )}
      />
      {error ? (
        <span id={errorId} role="alert" className="absolute top-full right-0 z-10 mt-1 w-44 rounded-md bg-ink px-2 py-1 text-xs text-surface shadow">
          {error}
        </span>
      ) : null}
    </span>
  );
}
