import "server-only";
import { cookies } from "next/headers";
import { siteUrl } from "@/lib/site-url";

/**
 * Session du particulier (sans compte).
 *
 * Le jeton secret de sa demande est conservé dans un cookie « httpOnly »
 * (inaccessible au JavaScript de la page), limité aux pages de l'entreprise
 * (/d/<slug>) et valable 30 jours. Il n'apparaît jamais dans les adresses :
 * aucune URL ne contient d'identifiant permettant d'accéder à une demande.
 *
 * Trois cookies distincts, tous limités à /d/<slug> :
 * - « demande en cours » (dsr_) : brouillon modifiable, repris si le client quitte le parcours ;
 *   retiré dès l'envoi, pour qu'une demande terminée ne bloque jamais une nouvelle demande ;
 * - « dernière demande envoyée » (dsl_) : lecture seule (écran de confirmation, lien « Voir ma demande ») ;
 * - « simulation » (dss_) : la prochaine demande créée sera marquée comme test (voir test-tools.ts).
 * Aucune demande n'est jamais supprimée par ces opérations.
 */

const MAX_AGE = 30 * 24 * 60 * 60;
const TOKEN = /^[0-9a-f]{64}$/;

type Kind = "draft" | "last" | "simulation";
const PREFIX: Record<Kind, string> = { draft: "dsr_", last: "dsl_", simulation: "dss_" };

function cookieName(companyId: string, kind: Kind = "draft") {
  return `${PREFIX[kind]}${companyId.replace(/-/g, "")}`;
}

async function setCookie(companyId: string, slug: string, kind: Kind, value: string, maxAge: number) {
  const secure = (await siteUrl()).startsWith("https://");
  (await cookies()).set(cookieName(companyId, kind), value, { httpOnly: true, secure, sameSite: "lax", path: `/d/${slug}`, maxAge });
}

export async function readDraftToken(companyId: string): Promise<string | null> {
  const value = (await cookies()).get(cookieName(companyId))?.value;
  return value && TOKEN.test(value) ? value : null;
}

export async function saveDraftToken(companyId: string, slug: string, token: string) {
  await setCookie(companyId, slug, "draft", token, MAX_AGE);
}

/** Oublie la demande en cours sur cet appareil (la demande elle-même n'est jamais supprimée). */
export async function clearDraftToken(companyId: string, slug: string) {
  (await cookies()).set(cookieName(companyId), "", { path: `/d/${slug}`, maxAge: 0 });
}

export async function readLastSentToken(companyId: string): Promise<string | null> {
  const value = (await cookies()).get(cookieName(companyId, "last"))?.value;
  return value && TOKEN.test(value) ? value : null;
}

/** Demande envoyée : elle devient « dernière demande envoyée » et cesse d'être la demande en cours. */
export async function markDraftSent(companyId: string, slug: string, token: string) {
  await setCookie(companyId, slug, "last", token, MAX_AGE);
  await clearDraftToken(companyId, slug);
}

export async function readSimulationFlag(companyId: string): Promise<boolean> {
  return (await cookies()).get(cookieName(companyId, "simulation"))?.value === "1";
}

export async function setSimulationFlag(companyId: string, slug: string, on: boolean) {
  if (on) await setCookie(companyId, slug, "simulation", "1", 24 * 60 * 60);
  else (await cookies()).set(cookieName(companyId, "simulation"), "", { path: `/d/${slug}`, maxAge: 0 });
}
