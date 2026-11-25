import { CheckCircle2, CircleDashed, Download, Loader2 } from "lucide-react";
import type { PublicQuoteView } from "@/lib/public-request/service";
import { Alert } from "@/components/ui/Alert";
import { QuoteDocument, quoteKindLabel } from "./QuoteDocument";
import { customerQuoteState } from "@/lib/quotes/customer-state";

type VerificationSummary = { verification?: boolean; amendment?: boolean; reason?: string; differences?: string[]; previous_version?: number };
const verificationOf = (changes: unknown): VerificationSummary | null =>
  changes && typeof changes === "object" && (changes as VerificationSummary).verification ? (changes as VerificationSummary) : null;

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
  sent: "Devis transmis par votre déménageur, en attente de votre réponse",
  accepted: "Devis accepté",
  refused: "Devis refusé",
  expired: "Devis expiré",
};

/**
 * Suivi côté particulier : progression réelle de l'analyse (étapes enregistrées en base),
 * puis estimation ou devis. Aucune étape n'est simulée à l'écran.
 */
export function FollowUp({ view, companyName, pdfHref, respond, versionPdfHref }: {
  view: PublicQuoteView; companyName: string; pdfHref: string | null;
  respond?: (quoteId: string, label?: string) => React.ReactNode; versionPdfHref?: (version: number) => string;
}) {
  const a = view.analysis;
  const state = customerQuoteState(view.quotes);
  const current = state.current;
  const pendingSummary = state.pending ? verificationOf(state.pending.changes) : null;
  const isAmendment = Boolean(state.pending?.amends_quote_id && state.inForce);
  // Correction sans changement de conditions : la plus récente, si aucune version plus récente ne l'a suivie.
  const sameTerms = view.corrections?.[0]?.outcome === "corrected_same_terms" ? view.corrections[0] : null;
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
          {isAmendment && state.inForce && state.pending ? (
            <Alert tone="warning" title={`Avenant à votre devis accepté (version ${state.pending.version})`}>
              <p>Votre devis accepté (version {state.inForce.version}) reste valable et inchangé. Après vérification de votre inventaire, {companyName} vous propose cet avenant : il ne s&apos;appliquera que si vous l&apos;acceptez.</p>
              <Differences summary={pendingSummary} />
              {versionPdfHref ? <a className="font-medium text-brand underline" href={versionPdfHref(state.inForce.version)}>Télécharger votre devis accepté (version {state.inForce.version})</a> : null}
            </Alert>
          ) : state.pending && pendingSummary ? (
            <Alert tone="info" title={`Nouvelle version de votre devis (version ${state.pending.version})`}>
              <p>{companyName} a vérifié votre inventaire. Cette version remplace la précédente{pendingSummary.previous_version ? ` (version ${pendingSummary.previous_version})` : ""}.</p>
              <Differences summary={pendingSummary} />
              {versionPdfHref && pendingSummary.previous_version ? <a className="font-medium text-brand underline" href={versionPdfHref(pendingSummary.previous_version)}>Télécharger la version précédente</a> : null}
            </Alert>
          ) : null}
          {state.lastRefused?.amends_quote_id && state.inForce ? (
            <Alert tone="info" title="Vous avez refusé l'avenant">
              Votre devis accepté (version {state.inForce.version}) reste en vigueur. {companyName} reviendra vers vous si nécessaire.
            </Alert>
          ) : null}
          {sameTerms && !state.pending ? (
            <Alert tone="success" title="Votre inventaire a été vérifié">
              <p>{companyName} a corrigé votre inventaire. Le montant et les conditions de votre devis sont inchangés : vous n&apos;avez rien à faire.</p>
              {sameTerms.reason ? <p>Raison : {sameTerms.reason}</p> : null}
              {sameTerms.changes.length ? <ul className="list-disc pl-5">{sameTerms.changes.map((c, i) => <li key={i}>{c.label}</li>)}</ul> : null}
            </Alert>
          ) : null}
          {state.pending && respond
            ? respond(state.pending.id, isAmendment ? "En acceptant, vous donnez votre accord sur cet avenant, qui remplacera votre devis accepté. En le refusant, votre devis accepté reste en vigueur." : undefined)
            : null}
          {current.status === "accepted" && !state.pending ? (
            <Alert tone="success" title="Vous avez accepté ce devis">
              {companyName} a été informé de votre accord{current.accepted_at ? ` (le ${new Date(current.accepted_at).toLocaleDateString("fr-FR")})` : ""}.
            </Alert>
          ) : null}
          <QuoteDocument quote={current} audience="customer" />
        </>
      ) : view.status === "customer_validated" ? (
        <Alert tone="info" title="Votre inventaire est validé">
          {companyName} finalise votre devis. Vous le retrouverez sur cette page dès qu&apos;il sera prêt.
        </Alert>
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

function Differences({ summary }: { summary: VerificationSummary | null }) {
  if (!summary) return null;
  return (
    <div className="mt-2 flex flex-col gap-1">
      {summary.reason ? <p>Raison : {summary.reason}</p> : null}
      {summary.differences?.length ? (
        <>
          <p className="font-medium">Différences avec la version précédente :</p>
          <ul className="list-disc pl-5">{summary.differences.map((d, i) => <li key={i}>{d}</li>)}</ul>
        </>
      ) : null}
    </div>
  );
}
