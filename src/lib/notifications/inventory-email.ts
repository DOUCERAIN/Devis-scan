import type { DescribedChange } from "../inventory/changes.ts";

/**
 * E-mail au client après une vérification humaine qui a modifié son inventaire.
 * Contenu seulement : l'envoi dépend d'un service d'e-mail (non configuré à ce jour, voir sendCustomerEmail).
 */
export type CorrectionOutcome = "corrected_same_terms" | "corrected_new_version" | "corrected_amendment";

export type CorrectionEmailInput = {
  companyName: string;
  customerName: string | null;
  reference: string;
  outcome: CorrectionOutcome;
  changes: DescribedChange[];
  volumeBeforeM3: number;
  volumeAfterM3: number;
  totalBeforeCents: number;
  totalAfterCents: number;
  reason: string;
  newVersion: number | null;
};

const euros = (cents: number) => `${(cents / 100).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
const m3 = (v: number) => `${v.toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} m³`;

export function buildCorrectionEmail(i: CorrectionEmailInput): { subject: string; text: string } {
  const group = (kind: DescribedChange["kind"], title: string) => {
    const lines = i.changes.filter((c) => c.kind === kind).map((c) => `  - ${c.label}`);
    return lines.length ? [`${title} :`, ...lines] : [];
  };
  const next =
    i.outcome === "corrected_same_terms"
      ? ["Le montant et les conditions de votre devis sont inchangés : vous n'avez rien à faire."]
      : i.outcome === "corrected_new_version"
        ? [`Une nouvelle version de votre devis (version ${i.newVersion}) vous est proposée. Elle remplace la précédente : vous pouvez la consulter, la télécharger, l'accepter ou la refuser depuis votre page de suivi.`]
        : [
            `Vous aviez déjà accepté votre devis. Il reste valable et inchangé.`,
            `Un avenant (version ${i.newVersion}) vous est proposé pour tenir compte de ces corrections. Il ne s'appliquera que si vous l'acceptez explicitement depuis votre page de suivi ; vous pouvez aussi le refuser.`,
          ];
  const subject =
    i.outcome === "corrected_same_terms"
      ? `${i.companyName} a vérifié votre inventaire (${i.reference}) : devis inchangé`
      : `${i.companyName} a vérifié votre inventaire (${i.reference}) : votre devis est modifié`;
  const text = [
    `Bonjour${i.customerName ? ` ${i.customerName}` : ""},`,
    "",
    `Un professionnel de ${i.companyName} a vérifié l'inventaire de votre demande ${i.reference}. Cette vérification humaine a entraîné une modification de votre inventaire.`,
    "",
    ...group("added", "Meubles ajoutés"),
    ...group("removed", "Meubles retirés"),
    ...group("corrected", "Meubles corrigés"),
    "",
    `Raison de la modification : ${i.reason}`,
    "",
    `Volume : ${m3(i.volumeBeforeM3)} → ${m3(i.volumeAfterM3)}`,
    `Montant TTC : ${euros(i.totalBeforeCents)} → ${euros(i.totalAfterCents)}`,
    "",
    ...next,
    "",
    "Pour revenir à votre demande, utilisez le lien de suivi que vous avez conservé lors de l'envoi.",
    "",
    `${i.companyName}`,
  ].join("\n");
  return { subject, text };
}
