"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Recharge les données de la page tant que l'analyse est en cours (toutes les 4 s, 15 min au plus). */
export function AutoRefresh({ active }: { active: boolean }) {
  const router = useRouter();
  useEffect(() => {
    if (!active) return;
    const started = Date.now();
    const id = setInterval(() => {
      if (Date.now() - started > 15 * 60_000) clearInterval(id);
      else router.refresh();
    }, 4000);
    return () => clearInterval(id);
  }, [active, router]);
  return null;
}
