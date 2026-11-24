"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { AppNav } from "./AppNav";

/** Menu de l'espace sur mobile : panneau ouvert par un bouton dans l'en-tête. */
export function MobileMenu({ pendingCount, footer }: { pendingCount: number; footer: ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="mobile-menu"
        className="inline-grid size-11 place-items-center rounded-md text-ink hover:bg-surface-subtle"
      >
        {open ? <X aria-hidden className="size-6" /> : <Menu aria-hidden className="size-6" />}
        <span className="sr-only">{open ? "Fermer le menu" : "Ouvrir le menu"}</span>
      </button>
      {open && (
        <div id="mobile-menu" className="fixed inset-x-0 top-16 bottom-0 z-30 overflow-y-auto border-t border-border bg-surface px-4 py-4">
          <AppNav pendingCount={pendingCount} onNavigate={() => setOpen(false)} />
          <div className="mt-4 border-t border-border pt-4">{footer}</div>
        </div>
      )}
    </>
  );
}
