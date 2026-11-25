import "server-only";
import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { getDraft, getPublicCompany, type Draft, type PublicCompany } from "@/lib/public-request/service";
import { isExpiredSession } from "@/lib/public-request/errors";
import { readDraftToken } from "@/lib/public-request/session";
import { reachableStep, STEPS, stepHref } from "@/lib/public-request/steps";

export type CustomerContext = { company: PublicCompany; token: string | null; draft: Draft | null; expired: boolean };

/** Entreprise du lien + brouillon du particulier (s'il en a un). Mis en cache le temps de la requête. */
export const loadContext = cache(async (slug: string): Promise<CustomerContext> => {
  const company = await getPublicCompany(slug);
  if (!company) notFound();
  const token = await readDraftToken(company.id);
  if (!token) return { company, token: null, draft: null, expired: false };
  try {
    return { company, token, draft: await getDraft(token), expired: false };
  } catch (error) {
    if (isExpiredSession(error)) return { company, token: null, draft: null, expired: true };
    throw error;
  }
});

/**
 * Étapes 2 à 5 : exige un brouillon modifiable dont les étapes précédentes sont remplies
 * (`step` = index de l'étape demandée) ; sinon, renvoie vers la première étape à compléter.
 */
export async function requireDraft(slug: string, step = 1) {
  const ctx = await loadContext(slug);
  if (!ctx.draft || !ctx.token) redirect(`${stepHref(slug, "trajet")}${ctx.expired ? "?session=expiree" : ""}`);
  if (ctx.draft.status !== "draft") redirect(stepHref(slug, "envoyee"));
  const reachable = reachableStep(ctx.draft);
  if (reachable < step) redirect(stepHref(slug, STEPS[reachable].key, ctx.draft.inventory_method));
  return { ...ctx, draft: ctx.draft, token: ctx.token, reachable };
}
