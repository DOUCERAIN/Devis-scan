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
 */

const MAX_AGE = 30 * 24 * 60 * 60;
const TOKEN = /^[0-9a-f]{64}$/;

function cookieName(companyId: string) {
  return `dsr_${companyId.replace(/-/g, "")}`;
}

export async function readDraftToken(companyId: string): Promise<string | null> {
  const value = (await cookies()).get(cookieName(companyId))?.value;
  return value && TOKEN.test(value) ? value : null;
}

export async function saveDraftToken(companyId: string, slug: string, token: string) {
  const secure = (await siteUrl()).startsWith("https://");
  (await cookies()).set(cookieName(companyId), token, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: `/d/${slug}`,
    maxAge: MAX_AGE,
  });
}

export async function clearDraftToken(companyId: string, slug: string) {
  (await cookies()).set(cookieName(companyId), "", { path: `/d/${slug}`, maxAge: 0 });
}
