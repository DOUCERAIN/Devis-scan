import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

/**
 * E-mails aux clients.
 *
 * AUCUN service d'e-mail transactionnel n'est configuré dans Devis Scan à ce jour. Les messages sont donc
 * préparés et CONSERVÉS (table customer_notifications, statut « not_configured »), affichés au déménageur
 * comme non envoyés, et jamais présentés comme partis. Brancher un service (Resend, Brevo, Postmark…)
 * consistera à envoyer les messages en attente et à passer leur statut à « sent » ou « failed ».
 */
export function emailServiceConfigured(): boolean {
  return false;
}

export async function queueCustomerEmail(
  supabase: SupabaseClient<Database>,
  m: { requestId: string; companyId: string; verificationId: string | null; kind: "inventory_corrected"; to: string | null; subject: string; text: string },
): Promise<"not_configured" | "no_recipient"> {
  const status = m.to ? "not_configured" : "no_recipient";
  const { error } = await supabase.from("customer_notifications").insert({
    request_id: m.requestId,
    company_id: m.companyId,
    verification_id: m.verificationId,
    kind: m.kind,
    to_email: m.to,
    subject: m.subject,
    body_text: m.text,
    status,
  });
  if (error) console.error("[e-mail] message non conservé", error);
  return status;
}
