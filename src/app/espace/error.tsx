"use client";

import { useEffect } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";

/** Erreur inattendue dans l'espace : message clair et possibilité de réessayer. */
export default function EspaceError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="flex max-w-reading flex-col gap-4">
      <Alert tone="danger" title="Impossible d'afficher cette page">
        Une erreur est survenue lors du chargement. Réessayez dans un instant ; si le problème persiste, contactez le support
        {error.digest ? ` en indiquant le code ${error.digest}` : ""}.
      </Alert>
      <Button variant="secondary" onClick={reset} className="self-start">Réessayer</Button>
    </div>
  );
}
