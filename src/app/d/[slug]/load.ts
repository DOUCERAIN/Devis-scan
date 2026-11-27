import "server-only";
import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { getDraft, getPublicCompany, type Draft, type PublicCompany } from "@/lib/public-request/service";
import { isExpiredSession } from "@/lib/public-request/errors";
import { readDraftToken, readLastSentToken } from "@/lib/public-request/session";
import { reachableStep, STEPS, stepHref } from "@/lib/public-request/steps";

export type CustomerContext = {
  company: PublicCompany;
  /** Jeton de la demande EN COURS (brouillon modifiable), sinon null. */
  token: string | null;
  /** Demande en cours, toujours au statut « draft ». */
  draft: Draft | null;
  expired: boolean;
  /** Dernière demande envoyée depuis cet appareil (lecture seule) et son jeton. */
  lastSent: Draft | null;
  lastSentToken: string | null;
};

async function readRequest(token: string | null): Promise<{ draft: Draft | null; expired: boolean }> {
  if (!token) return { draft: null, expired: false };
  try {
    return { draft: await getDraft(token), expired: false };
  } catch (error) {
    if (isExpiredSession(error)) return { draft: null, expired: true };
    throw error;
  }
}

/**
 * Entreprise du lien + demande en cours du particulier + dernière demande envoyée. Mis en cache le temps de
 * la requête. Une demande envoyée n'est jamais présentée comme « en cours » : elle ne bloque donc pas une
 * nouvelle demande (y compris pour un ancien cookie qui désignerait encore une demande envoyée).
 */
export const loadContext = cache(async (slug: string): Promise<CustomerContext> => {
  const company = await getPublicCompany(slug);
  if (!company) notFound();
  const [draftToken, lastToken] = await Promise.all([readDraftToken(company.id), readLastSentToken(company.id)]);
  const current = await readRequest(draftToken);
  if (current.draft && current.draft.status !== "draft") {
    // Ancien fonctionnement : le cookie « en cours » désigne une demande déjà envoyée.
    return { company, token: null, draft: null, expired: false, lastSent: current.draft, lastSentToken: draftToken };
  }
  const last = lastToken && lastToken !== draftToken ? await readRequest(lastToken) : { draft: null, expired: false };
  return {
    company, token: current.draft ? draftToken : null, draft: current.draft, expired: current.expired,
    lastSent: last.draft && last.draft.status !== "draft" ? last.draft : null,
    lastSentToken: last.draft && last.draft.status !== "draft" ? lastToken : null,
  };
});

/**
 * Étapes 2 à 5 : exige un brouillon modifiable dont les étapes précédentes sont remplies
 * (`step` = index de l'étape demandée) ; sinon, renvoie vers la première étape à compléter.
 */
export async function requireDraft(slug: string, step = 1) {
  const ctx = await loadContext(slug);
  if (!ctx.draft || !ctx.token) {
    // Demande déjà envoyée et aucune nouvelle demande commencée : confirmation (non modifiable).
    if (ctx.lastSent && !ctx.expired) redirect(stepHref(slug, "envoyee"));
    redirect(`${stepHref(slug, "trajet")}${ctx.expired ? "?session=expiree" : ""}`);
  }
  const reachable = reachableStep(ctx.draft);
  if (reachable < step) redirect(stepHref(slug, STEPS[reachable].key, ctx.draft.inventory_method));
  return { ...ctx, draft: ctx.draft, token: ctx.token, reachable };
}
