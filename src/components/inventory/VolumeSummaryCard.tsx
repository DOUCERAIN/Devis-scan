import { formatVolume, type VolumeSummary } from "@/lib/inventory/volume";
import { Alert } from "@/components/ui/Alert";
import { cn } from "@/components/ui/cn";

type Props = { summary: VolumeSummary; audience: "pro" | "client"; className?: string };

/**
 * Récapitulatif du volume (règles validées) :
 * volume confirmé, volume à vérifier et volume potentiel affichés séparément,
 * fourchette du volume total, et alerte de vérification humaine si besoin.
 */
export function VolumeSummaryCard({ summary, audience, className }: Props) {
  const { confirmedM3, toVerifyM3, potentialM3, estimatedM3, maxM3, itemsToReview, needsHumanReview } = summary;
  const hasRange = maxM3 > estimatedM3;
  const plural = itemsToReview > 1 ? "s" : "";

  return (
    <section aria-label="Volume du déménagement" className={cn("flex min-w-0 flex-col gap-4 rounded-lg border border-border bg-surface p-4 sm:p-5", className)}>
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
        <div>
          <p className="text-[13px] leading-5 text-ink-secondary">Volume estimé</p>
          <p className="text-[28px] leading-[34px] font-semibold tracking-[-0.01em] tabular-nums text-ink">{formatVolume(estimatedM3)}</p>
        </div>
        {hasRange && (
          <p className="text-[13px] leading-5 text-ink-secondary tabular-nums">
            Fourchette : entre {formatVolume(estimatedM3)} et {formatVolume(maxM3)}
          </p>
        )}
      </div>

      <dl className="grid grid-cols-1 gap-2 text-sm leading-5 sm:grid-cols-3">
        <Row color="bg-success" label="Confirmé" value={confirmedM3} hint="sûr ou validé" />
        <Row color="bg-warning" label="À vérifier" value={toVerifyM3} hint="compté dans l'estimation" />
        <Row color="bg-danger" label="Potentiel" value={potentialM3} hint="incertain ou doublon, non compté" />
      </dl>

      {needsHumanReview &&
        (audience === "pro" ? (
          <Alert tone="warning" title="Vérification humaine nécessaire">
            {itemsToReview} élément{plural} à contrôler avant d&apos;envoyer le devis. Consultez les vidéos pour les confirmer, les corriger ou les retirer.
          </Alert>
        ) : (
          <Alert tone="warning" title={`${itemsToReview} élément${plural} à confirmer`}>
            Un coup d&apos;œil suffit pour fiabiliser votre devis.
          </Alert>
        ))}
    </section>
  );
}

function Row({ color, label, value, hint }: { color: string; label: string; value: number; hint: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md bg-canvas px-3 py-2.5 sm:flex-col sm:items-start sm:justify-start sm:gap-1">
      <dt className="flex items-center gap-2 text-ink-secondary">
        <span aria-hidden className={cn("size-2 rounded-full", color)} />
        {label}
      </dt>
      <dd className="text-right sm:text-left">
        <span className="font-semibold tabular-nums text-ink">{formatVolume(value)}</span>
        <span className="block text-xs leading-4 text-ink-muted">{hint}</span>
      </dd>
    </div>
  );
}
