"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { failure, validationFailure, type ActionState } from "@/lib/errors";
import { formToObject, nestDotted } from "@/lib/form-data";
import { isExpiredSession, publicErrorMessage } from "@/lib/public-request/errors";
import { clearDraftToken, readDraftToken, saveDraftToken } from "@/lib/public-request/session";
import {
  addRoom, createDraft, getDraft, getPublicCompany, removeRoom, submitDraft, updateDraft, updateRoom,
} from "@/lib/public-request/service";
import { stepHref } from "@/lib/public-request/steps";
import { dwellingsPayload, dwellingsSchema, finalNotesSchema, roomSchema, tripPayload, tripSchema } from "@/lib/validation/public-request";

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
  if (!parsed.success) return validationFailure(parsed.error, raw);
  const payload = tripPayload(parsed.data);
  try {
    if (token) {
      await updateDraft(token, payload);
    } else {
      const newToken = await createDraft(slug, payload);
      await saveDraftToken(company.id, slug, newToken);
    }
  } catch (error) {
    if (token && isExpiredSession(error)) {
      await clearDraftToken(company.id, slug);
      return failure("Votre session a expiré. Vos informations ont été conservées : envoyez à nouveau le formulaire pour recommencer.", undefined, raw);
    }
    return failure(publicErrorMessage(error, "saveTrip"), undefined, raw);
  }
  refresh(slug);
  redirect(stepHref(slug, "logements"));
}

export async function saveDwellings(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { slug, token } = await context(formData);
  if (!token) expired(slug);
  const raw = formToObject(formData);
  const parsed = dwellingsSchema.safeParse(nestDotted(raw));
  if (!parsed.success) return validationFailure(parsed.error, raw);
  try {
    await updateDraft(token, dwellingsPayload(parsed.data));
  } catch (error) {
    if (isExpiredSession(error)) expired(slug);
    return failure(publicErrorMessage(error, "saveDwellings"), undefined, raw);
  }
  refresh(slug);
  redirect(stepHref(slug, "pieces"));
}

export async function saveRoom(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { slug, token } = await context(formData);
  if (!token) expired(slug);
  const raw = formToObject(formData);
  const parsed = roomSchema.safeParse(raw);
  if (!parsed.success) return validationFailure(parsed.error, raw);
  try {
    const { name, kind, description } = parsed.data;
    if (raw.room_id) await updateRoom(token, raw.room_id, name, kind ?? null, description ?? null);
    else await addRoom(token, name, kind ?? null, description ?? null);
  } catch (error) {
    if (isExpiredSession(error)) expired(slug);
    return failure(publicErrorMessage(error, "saveRoom"), undefined, raw);
  }
  refresh(slug);
  return { status: "success", message: raw.room_id ? "Pièce modifiée." : `« ${parsed.data.name} » ajoutée.` };
}

export async function deleteRoom(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { slug, token } = await context(formData);
  if (!token) expired(slug);
  const roomId = String(formData.get("room_id") ?? "");
  try {
    const draft = await getDraft(token);
    const room = draft.rooms.find((r) => r.id === roomId);
    if (!room) return failure("Cette pièce n'existe plus.");
    await removeRoom(token, room);
  } catch (error) {
    if (isExpiredSession(error)) expired(slug);
    return failure(publicErrorMessage(error, "deleteRoom"));
  }
  refresh(slug);
  return { status: "success", message: "Pièce supprimée." };
}

export async function continueToVideos(formData: FormData) {
  const { slug, token } = await context(formData);
  if (!token) expired(slug);
  redirect(stepHref(slug, "videos"));
}

export async function submitRequest(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { slug, token } = await context(formData);
  if (!token) expired(slug);
  const raw = formToObject(formData);
  const parsed = finalNotesSchema.safeParse(raw);
  if (!parsed.success) return validationFailure(parsed.error, raw);
  try {
    await updateDraft(token, { customer_notes: parsed.data.customer_notes ?? "" });
    await submitDraft(token);
  } catch (error) {
    if (isExpiredSession(error)) expired(slug);
    // Double envoi : la demande est déjà partie, on affiche simplement la confirmation.
    if (/already submitted/i.test(String((error as { message?: string })?.message))) redirect(stepHref(slug, "envoyee"));
    return failure(publicErrorMessage(error, "submitRequest"), undefined, raw);
  }
  refresh(slug);
  redirect(stepHref(slug, "envoyee"));
}

/** Abandonne la demande en cours sur cet appareil et en commence une nouvelle. */
export async function restartRequest(formData: FormData) {
  const { slug, company } = await context(formData);
  await clearDraftToken(company.id, slug);
  refresh(slug);
  redirect(stepHref(slug, "trajet"));
}
