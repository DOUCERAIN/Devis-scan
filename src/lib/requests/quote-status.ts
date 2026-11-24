import type { BadgeTone } from "../../components/ui/Badge.tsx";

/** Statuts d'un devis (miroir de l'énumération SQL quote_status). */
export const QUOTE_STATUS_META: Record<string, { label: string; tone: BadgeTone }> = {
  draft: { label: "Brouillon", tone: "neutral" },
  generated: { label: "Devis initial généré", tone: "brand" },
  corrected: { label: "Devis corrigé", tone: "warning" },
  sent: { label: "Devis envoyé", tone: "brand" },
  accepted: { label: "Accepté", tone: "success" },
  refused: { label: "Refusé", tone: "danger" },
  expired: { label: "Expiré", tone: "neutral" },
  cancelled: { label: "Annulé", tone: "neutral" },
  superseded: { label: "Remplacé par une version plus récente", tone: "neutral" },
};
