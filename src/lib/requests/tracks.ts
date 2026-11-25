import type { BadgeTone } from "../../components/ui/Badge.tsx";

/**
 * Deux suivis indépendants d'une demande :
 * - le devis (validation du client, envoi, réponses, nouvelles versions et avenants) ;
 * - la vérification humaine par le déménageur.
 */
export type QuoteTrackKey =
  | "analysis_running"
  | "analysis_done"
  | "awaiting_customer"
  | "customer_validated"
  | "quote_sent"
  | "accepted"
  | "refused"
  | "new_version_sent"
  | "new_version_accepted"
  | "new_version_refused";

export type VerificationTrackKey = "not_required" | "pending" | "verified" | "corrected";

export const QUOTE_TRACK: Record<QuoteTrackKey, { label: string; tone: BadgeTone }> = {
  analysis_running: { label: "Analyse IA en cours", tone: "neutral" },
  analysis_done: { label: "Analyse IA terminée", tone: "neutral" },
  awaiting_customer: { label: "Inventaire en attente de validation client", tone: "warning" },
  customer_validated: { label: "Inventaire validé par le client", tone: "brand" },
  quote_sent: { label: "Devis transmis au client", tone: "brand" },
  accepted: { label: "Devis accepté par le client", tone: "success" },
  refused: { label: "Devis refusé par le client", tone: "danger" },
  new_version_sent: { label: "Nouvelle version du devis transmise", tone: "warning" },
  new_version_accepted: { label: "Nouvelle version acceptée", tone: "success" },
  new_version_refused: { label: "Nouvelle version refusée", tone: "danger" },
};

export const VERIFICATION_TRACK: Record<VerificationTrackKey, { label: string; tone: BadgeTone }> = {
  not_required: { label: "Vérification non commencée", tone: "neutral" },
  pending: { label: "Vérification humaine en attente", tone: "warning" },
  verified: { label: "Vérifié par le déménageur", tone: "success" },
  corrected: { label: "Inventaire corrigé par le déménageur", tone: "brand" },
};

type Q = { version: number; status: string; origin: string };

/** Suivi du devis, déduit du statut de la demande et des versions (les versions ne sont jamais modifiées). */
export function quoteTrack(requestStatus: string, quotes: readonly Q[], analysisStatus: string | null): QuoteTrackKey {
  const visible = [...quotes].filter((q) => q.status !== "superseded" && q.status !== "draft").sort((a, b) => b.version - a.version);
  const sent = visible.filter((q) => ["sent", "accepted", "refused", "expired"].includes(q.status));
  const latest = sent[0];
  if (latest) {
    // « Nouvelle version » : une version transmise après une première version déjà transmise au client.
    const isNew = sent.length > 1 || latest.origin === "verification";
    if (latest.status === "accepted") return isNew ? "new_version_accepted" : "accepted";
    if (latest.status === "refused") return isNew ? "new_version_refused" : "refused";
    return isNew ? "new_version_sent" : "quote_sent";
  }
  if (requestStatus === "awaiting_customer") return "awaiting_customer";
  if (requestStatus === "customer_validated") return "customer_validated";
  if (analysisStatus === "queued" || analysisStatus === "running" || requestStatus === "analyzing" || requestStatus === "submitted") return "analysis_running";
  return "analysis_done";
}

export function verificationTrack(status: string): VerificationTrackKey {
  return status === "pending" || status === "verified" || status === "corrected" ? status : "not_required";
}
