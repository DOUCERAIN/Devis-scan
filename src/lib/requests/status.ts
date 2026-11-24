import type { BadgeTone } from "../../components/ui/Badge.tsx";

/** Statuts d'une demande de devis (miroir de l'énumération SQL request_status). */
export const REQUEST_STATUSES = [
  "draft",
  "submitted",
  "analyzing",
  "to_review",
  "quote_sent",
  "accepted",
  "refused",
  "cancelled",
  "archived",
] as const;

export type RequestStatus = (typeof REQUEST_STATUSES)[number];

export const STATUS_META: Record<RequestStatus, { label: string; tone: BadgeTone; description: string }> = {
  draft: { label: "Brouillon", tone: "neutral", description: "Le client n'a pas encore envoyé sa demande." },
  submitted: { label: "Nouvelle", tone: "brand", description: "Demande reçue, à prendre en charge." },
  analyzing: { label: "Analyse en cours", tone: "neutral", description: "Les vidéos sont en cours d'analyse." },
  to_review: { label: "À vérifier", tone: "warning", description: "Inventaire prêt, à vérifier avant le devis." },
  quote_sent: { label: "Devis envoyé", tone: "neutral", description: "En attente de la réponse du client." },
  accepted: { label: "Acceptée", tone: "success", description: "Le client a accepté le devis." },
  refused: { label: "Refusée", tone: "danger", description: "Le client a refusé le devis." },
  cancelled: { label: "Annulée", tone: "neutral", description: "Demande annulée." },
  archived: { label: "Archivée", tone: "neutral", description: "Demande classée." },
};

/** Statuts qu'un déménageur peut choisir à la main (les autres sont posés par le système). */
export const MANUAL_STATUSES: readonly RequestStatus[] = [
  "submitted",
  "to_review",
  "quote_sent",
  "accepted",
  "refused",
  "cancelled",
  "archived",
];

/** Regroupements utilisés par les filtres de la liste des demandes. */
export const STATUS_FILTERS = {
  toutes: { label: "Toutes", statuses: null },
  a_traiter: { label: "À traiter", statuses: ["submitted", "analyzing", "to_review"] },
  envoyees: { label: "Devis envoyés", statuses: ["quote_sent"] },
  terminees: { label: "Terminées", statuses: ["accepted", "refused", "cancelled", "archived"] },
} as const satisfies Record<string, { label: string; statuses: readonly RequestStatus[] | null }>;

export type StatusFilter = keyof typeof STATUS_FILTERS;

export function isStatusFilter(value: unknown): value is StatusFilter {
  return typeof value === "string" && value in STATUS_FILTERS;
}

/** Référence lisible d'une demande : « DS-0042 ». */
export function requestReference(prefix: string, num: number): string {
  return `${prefix}-${String(num).padStart(4, "0")}`;
}
