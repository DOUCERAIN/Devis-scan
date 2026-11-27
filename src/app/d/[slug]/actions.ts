"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { runRequestAnalysis } from "@/lib/analysis/run";
import { failure, success, validationFailure, type ActionState } from "@/lib/errors";
import { formToObject, nestDotted } from "@/lib/form-data";
import { isExpiredSession, publicErrorMessage } from "@/lib/public-request/errors";
import {
  clearDraftToken, markDraftSent, readDraftToken, readLastSentToken, readSimulationFlag, saveDraftToken, setSimulationFlag,
} from "@/lib/public-request/session";
import { markRequestAsTest, testToolsEnabled } from "@/lib/public-request/test-tools";
import {
  createDraft, getDraft, getPublicCompany, requestIdForViewToken, setDraftOptions, submitDraft, submitManualDraft, updateDraft,
} from "@/lib/public-request/service";
import { stepHref } from "@/lib/public-request/steps";
import {
  checkAlternativeDates, contactPayload, contactSchema, finalNotesSchema, methodSchema, tripPayload, tripSchema,
} from "@/lib/validation/public-request";
import { geocodeAddress } from "@/lib/address/api";
import { MANUAL_INVENTORY_WARNING } from "@/lib/inventory/manual";
import { createAdminClient } from "@/lib/supabase/admin";
import { issueFinalQuote } from "@/lib/quotes/customer-validation";

/**
 * Actions du parcours particulier. L'entreprise est toujours retrouvée à partir
 * du lien (slug) côté serveur, et la demande à partir du cookie de session :
 * le navigateur ne peut désigner ni une autre entreprise, ni une autre demande.
 */

async function context(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const company = await getPublicCompany(slug);
  if (!company) redirect("/");
  const token = await readDraftToken(company.id);
  return { slug, company, token };
}

function expired(slug: string): never {
  redirect(`${stepHref(slug, "trajet")}?session=expiree`);
}

function refresh(slug: string) {
  revalidatePath(`/d/${slug}`, "layout");
}

export async function saveTrip(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { slug, company, token } = await context(formData);
  const raw = formToObject(formData);
  const parsed = tripSchema.safeParse(nestDotted(raw));
  const alt = checkAlternativeDates(formData.getAll("alternative_moving_dates").map(String), parsed.success ? parsed.data.moving_date : raw.moving_date);
  if (!parsed.success || Object.keys(alt.errors).length > 0) {
    const base = parsed.success ? null : validationFailure(parsed.error, raw);
    const fieldErrors = { ...(base?.status === "error" ? base.fieldErrors : {}), ...alt.errors };
    return failure("Certains champs sont à corriger.", fieldErrors, raw);
  }
  // Adresse saisie sans choisir de suggestion : coordonnées recherchées côté serveur (pour la distance).
  for (const kind of ["origin", "destination"] as const) {
    const a = parsed.data[kind];
    if (a.latitude === undefined || a.longitude === undefined) {
      const found = await geocodeAddress(a.address_line, a.postal_code ?? "", a.city);
      if (found) Object.assign(a, found);
    }
  }
  const payload = tripPayload(parsed.data, alt.dates);
  // Une demande déjà envoyée n'est jamais modifiée : on en crée une nouvelle, indépendante.
  const editable = token ? await getDraft(token).then((d) => d.status === "draft").catch(() => true) : false;
  try {
    if (token && editable) {
      await updateDraft(token, payload);
    } else {
      const newToken = await createDraft(slug, payload);
      await saveDraftToken(company.id, slug, newToken);
      // « Nouvelle simulation » : la demande est marquée comme test (contrôle refait côté serveur).
      if (await readSimulationFlag(company.id)) {
        if (await testToolsEnabled(company.id)) await markRequestAsTest(newToken);
        await setSimulationFlag(company.id, slug, false);
      }
    }
  } catch (error) {
    if (token && isExpiredSession(error)) {
      await clearDraftToken(company.id, slug);
      return failure("Votre session a expiré. Vos informations ont été conservées : envoyez à nouveau le formulaire pour recommencer.", undefined, raw);
    }
    return failure(publicErrorMessage(error, "saveTrip"), undefined, raw);
  }
  refresh(slug);
  redirect(stepHref(slug, "coordonnees"));
}

/** Étape 2 : coordonnées (particulier ou entreprise) et consentements. */
export async function saveContact(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { slug, token } = await context(formData);
  if (!token) expired(slug);
  const raw = formToObject(formData);
  const parsed = contactSchema.safeParse(raw);
  if (!parsed.success) return validationFailure(parsed.error, raw);
  try {
    await updateDraft(token, contactPayload(parsed.data));
  } catch (error) {
    if (isExpiredSession(error)) expired(slug);
    return failure(publicErrorMessage(error, "saveContact"), undefined, raw);
  }
  refresh(slug);
  redirect(stepHref(slug, "methode"));
}

/** Étape 3 : méthode d'inventaire (vidéos analysées ou inventaire manuel). */
export async function chooseMethod(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { slug, token } = await context(formData);
  if (!token) expired(slug);
  const parsed = methodSchema.safeParse(formToObject(formData));
  if (!parsed.success) return validationFailure(parsed.error, {});
  try {
    await updateDraft(token, { inventory_method: parsed.data.inventory_method });
  } catch (error) {
    if (isExpiredSession(error)) expired(slug);
    return failure(publicErrorMessage(error, "chooseMethod"));
  }
  refresh(slug);
  redirect(stepHref(slug, "inventaire", parsed.data.inventory_method));
}

export async function continueToSummary(formData: FormData) {
  const { slug, token } = await context(formData);
  if (!token) expired(slug);
  redirect(stepHref(slug, "recapitulatif"));
}

export async function submitRequest(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { slug, company, token } = await context(formData);
  if (!token) {
    // Second envoi arrivé après le premier : la demande est déjà partie.
    if (await readLastSentToken(company.id)) redirect(stepHref(slug, "envoyee"));
    expired(slug);
  }
  const raw = formToObject(formData);
  const parsed = finalNotesSchema.safeParse(raw);
  if (!parsed.success) return validationFailure(parsed.error, raw);
  let viewToken: string;
  let manual = false;
  try {
    const draft = await getDraft(token);
    manual = draft.inventory_method === "manual";
    if (manual && raw.acknowledged !== "on") {
      return failure("Confirmez avoir pris connaissance de l'avertissement avant d'envoyer.", { acknowledged: "Confirmation obligatoire." }, raw);
    }
    await updateDraft(token, { customer_notes: parsed.data.customer_notes ?? "" });
    viewToken = manual ? await submitManualDraft(token, MANUAL_INVENTORY_WARNING) : await submitDraft(token);
  } catch (error) {
    if (isExpiredSession(error)) expired(slug);
    // Double envoi : la demande est déjà partie, on affiche simplement la confirmation.
    if (/already submitted/i.test(String((error as { message?: string })?.message))) {
      await markDraftSent(company.id, slug, token);
      redirect(stepHref(slug, "envoyee"));
    }
    return failure(publicErrorMessage(error, "submitRequest"), undefined, raw);
  }
  // La demande envoyée cesse d'être « en cours » sur cet appareil : le lien de l'entreprise permet
  // aussitôt d'en commencer une nouvelle ; elle reste consultable (« Voir ma demande »).
  await markDraftSent(company.id, slug, token);
  const sentToken = viewToken;
  if (manual) {
    // Inventaire saisi et validé par le client : devis final calculé immédiatement (grille de l'entreprise).
    const requestId = await requestIdForViewToken(sentToken);
    const admin = createAdminClient();
    const outcome = requestId && admin ? await issueFinalQuote(admin, requestId) : { status: "pending_mover" as const, reason: "configuration serveur incomplète" };
    if (outcome.status === "pending_mover") console.warn("[parcours] devis final en attente du déménageur :", outcome.reason);
  } else {
    // Analyse lancée après la réponse (le client suit la progression sur la page du devis).
    after(async () => {
      const requestId = await requestIdForViewToken(sentToken);
      if (requestId) await runRequestAnalysis(requestId);
    });
  }
  refresh(slug);
  redirect(`/d/${slug}/devis/${viewToken}`);
}

/** Options proposées par l'entreprise et choisies par le client (prix calculés côté serveur). */
export async function saveOptions(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { slug, token } = await context(formData);
  if (!token) expired(slug);
  const chosen = formData.getAll("option").map(String).filter((id) => /^[0-9a-f-]{36}$/.test(id)).slice(0, 30);
  const options = chosen.map((id) => {
    const q = Number(formData.get(`quantity_${id}`) ?? 1);
    return { option_id: id, quantity: Number.isInteger(q) && q >= 1 && q <= 99 ? q : 1 };
  });
  try {
    await setDraftOptions(token, options);
  } catch (error) {
    if (isExpiredSession(error)) expired(slug);
    return failure(publicErrorMessage(error, "saveOptions"));
  }
  refresh(slug);
  return success(options.length ? "Options enregistrées." : "Aucune option retenue.");
}

/**
 * Nouvelle demande de devis (ou « Recommencer depuis le début ») : la demande en cours est simplement
 * oubliée sur cet appareil et une nouvelle, vierge et indépendante, commence à l'étape 1. Rien n'est
 * supprimé : une demande envoyée reste chez le déménageur ; un brouillon jamais envoyé suit la règle
 * habituelle des abandons (purge après 30 jours).
 */
export async function startNewRequest(formData: FormData) {
  const { slug, company } = await context(formData);
  await clearDraftToken(company.id, slug);
  await setSimulationFlag(company.id, slug, false);
  refresh(slug);
  redirect(stepHref(slug, "trajet"));
}

/** « Nouvelle simulation » (démonstration ou test uniquement) : nouvelle demande marquée comme test. */
export async function startSimulation(formData: FormData) {
  const { slug, company } = await context(formData);
  if (!(await testToolsEnabled(company.id))) redirect(`/d/${slug}`);
  await clearDraftToken(company.id, slug);
  await setSimulationFlag(company.id, slug, true);
  refresh(slug);
  redirect(stepHref(slug, "trajet"));
}
