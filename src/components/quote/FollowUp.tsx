import { CheckCircle2, CircleDashed, Download, Loader2 } from "lucide-react";
import type { PublicQuoteView } from "@/lib/public-request/service";
import { Alert } from "@/components/ui/Alert";
import { QuoteDocument, quoteKindLabel } from "./QuoteDocument";

const STAGES = [
  { key: "rooms", label: "Analyse des pièces" },
  { key: "recognition", label: "Reconnaissance du mobilier" },
  { key: "volumes", label: "Calcul des volumes" },
  { key: "pricing", label: "Calcul du tarif" },
  { key: "quote", label: "Préparation du devis" },
] as const;

const ORDER = ["queued", ...STAGES.map((s) => s.key), "done"];

/** Vrai tant que la page doit se rafraîchir pour suivre l'analyse. */
export function analysisPending(view: PublicQuoteView): boolean {
  if (view.analysis === null) return view.status === "submitted" || view.status === "analyzing";
  return view.analysis.status === "queued" || view.analysis.status === "running";
}

const STATUS_TEXT: Record<string, string> = {
  generated: "Estimation initiale",
  corrected: "Estimation mise à jour par votre déménageur",
  sent: "Devis envoyé par votre déménageur, en attente de votre réponse",
  accepted: "Devis accepté",
  refused: "Devis refusé",
  expired: "Devis expiré",
};

/**
 * Suivi côté particulier : progression réelle de l'analyse (étapes enregistrées en base),
 * puis estimation ou devis. Aucune étape n'est simulée à l'écran.
 */
export function FollowUp({ view, companyName, pdfHref, respond }: { view: PublicQuoteView; companyName: string; pdfHref: string | null; respond?: (quoteId: string) => React.ReactNode }) {
  const a = view.analysis;
  const current = view.quotes.find((q) => q.status !== "superseded") ?? null;
  const pending = analysisPending(view);
  const stageIndex = a ? ORDER.indexOf(a.status === "succeeded" ? "done" : (a.stage ?? "queued")) : 0;

  return (
    <div className="flex flex-col gap-5">
      {a?.simulated ? (
        <Alert tone="warning" title="Environnement de test">
          Résultat produit par le simulateur de test, et non par une analyse réelle des vidéos.
        </Alert>
      ) : null}

      {pending ? (
        <section aria-live="polite" className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4 sm:p-6">
          <h2 className="font-semibold">Analyse de vos vidéos en cours</h2>
          <p className="text-sm text-ink-secondary">Cela prend en général quelques minutes. Vous pouvez fermer cette page et revenir plus tard avec le même lien.</p>
          <ol className="flex flex-col gap-2">
            {STAGES.map((stage, i) => {
              const index = ORDER.indexOf(stage.key);
              const done = stageIndex > index;
              const active = stageIndex === index || (i === 0 && stageIndex <= 1);
              return (
                <li key={stage.key} className="flex items-center gap-2 text-sm">
                  {done ? (
                    <CheckCircle2 aria-hidden className="size-5 text-success" />
                  ) : active ? (
                    <Loader2 aria-hidden className="size-5 animate-spin text-brand" />
                  ) : (
                    <CircleDashed aria-hidden className="size-5 text-ink-disabled" />
                  )}
                  <span className={done || active ? "text-ink" : "text-ink-muted"}>
                    {stage.label}
                    {stage.key === "recognition" && active && a?.rooms_total ? ` (${a.rooms_done ?? 0} / ${a.rooms_total} pièces)` : ""}
                  </span>
                  <span className="sr-only">{done ? "terminé" : active ? "en cours" : "à venir"}</span>
                </li>
              );
            })}
          </ol>
        </section>
      ) : current ? (
        <>
          <section className="flex flex-col gap-1">
            <p className="text-sm font-medium text-ink-secondary">{STATUS_TEXT[current.status] ?? quoteKindLabel(current)}</p>
            {pdfHref ? (
              <a href={pdfHref} className="inline-flex h-11 w-fit items-center gap-2 rounded-md border border-border-input px-4 text-sm font-medium hover:bg-surface-subtle">
                <Download aria-hidden className="size-4" /> Télécharger en PDF
              </a>
            ) : null}
          </section>
          {current.status === "sent" && respond ? respond(current.id) : null}
          {current.status === "accepted" ? (
            <Alert tone="success" title="Vous avez accepté ce devis">
              {companyName} a été informé de votre accord{current.accepted_at ? ` (le ${new Date(current.accepted_at).toLocaleDateString("fr-FR")})` : ""}.
            </Alert>
          ) : null}
          <QuoteDocument quote={current} audience="customer" />
        </>
      ) : (
        <Alert tone="info" title="Votre demande est entre les mains de votre déménageur">
          {a?.status === "failed"
            ? `L'estimation automatique n'a pas pu être établie. ${companyName} va examiner vos vidéos et vous adressera son devis.`
            : `Votre inventaire est prêt. ${companyName} doit encore le vérifier et compléter son tarif avant de vous communiquer un prix : vous serez recontacté.`}
        </Alert>
      )}
    </div>
  );
}
