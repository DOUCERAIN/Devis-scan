"use server";

import { revalidatePath } from "next/cache";
import { isExpiredSession, publicErrorMessage } from "@/lib/public-request/errors";
import { readDraftToken } from "@/lib/public-request/session";
import { addInventoryItem, getCustomerCatalog, getPublicCompany, removeInventoryItem, setInventoryQuantity } from "@/lib/public-request/service";
import { catalogItemSchema, customItemSchema } from "@/lib/validation/public-request";
import { formToObject } from "@/lib/form-data";

/**
 * Inventaire saisi ou corrigé par le client. Le jeton vient du cookie du brouillon (inventaire manuel)
 * ou du lien de suivi (inventaire de l'analyse à valider) ; la base vérifie à chaque appel que la demande
 * accepte encore des modifications et que l'objet lui appartient.
 */

export type InventoryResult = { ok: true; message?: string } | { ok: false; message: string; fieldErrors?: Record<string, string> };

const HEX64 = /^[0-9a-f]{64}$/;
const UUID = /^[0-9a-f-]{36}$/;

async function resolveToken(slug: string, viewToken: string | null): Promise<string | null> {
  if (viewToken) return HEX64.test(viewToken) ? viewToken : null;
  const company = await getPublicCompany(slug);
  if (!company) return null;
  return readDraftToken(company.id);
}

function refresh(slug: string, viewToken: string | null) {
  revalidatePath(viewToken ? `/d/${slug}/devis/${viewToken}` : `/d/${slug}`, viewToken ? "page" : "layout");
}

function failed(error: unknown, context: string): InventoryResult {
  if (isExpiredSession(error)) return { ok: false, message: "Votre session a expiré. Rechargez la page." };
  return { ok: false, message: publicErrorMessage(error, context) };
}

function issuesToFields(issues: { path: PropertyKey[]; message: string }[]) {
  const fieldErrors: Record<string, string> = {};
  for (const i of issues) fieldErrors[i.path.join(".")] ??= i.message;
  return fieldErrors;
}

/** Ajoute un objet du catalogue (quantité 1 par défaut). Sans volume de référence : taille demandée. */
export async function addCatalogItem(slug: string, viewToken: string | null, input: { catalog_key: string; category: string; quantity?: number; size?: string }): Promise<InventoryResult> {
  const token = await resolveToken(slug, viewToken);
  if (!token) return { ok: false, message: "Votre session a expiré. Rechargez la page." };
  const parsed = catalogItemSchema.safeParse({ ...input, quantity: String(input.quantity ?? 1) });
  if (!parsed.success) return { ok: false, message: "Objet invalide.", fieldErrors: issuesToFields(parsed.error.issues) };
  const ref = (await getCustomerCatalog()).find((c) => c.id === parsed.data.catalog_key);
  if (!ref) return { ok: false, message: "Cet objet n'est plus disponible." };
  if (ref.volume === null && !parsed.data.size) return { ok: false, message: "Indiquez une taille approximative pour cet objet.", fieldErrors: { size: "Taille obligatoire." } };
  try {
    await addInventoryItem(token, { ...parsed.data, size: ref.volume === null ? parsed.data.size : undefined });
  } catch (error) {
    return failed(error, "addCatalogItem");
  }
  refresh(slug, viewToken);
  return { ok: true, message: `« ${ref.name} » ajouté.` };
}

/** Objet personnalisé : description obligatoire, quantité, dimensions ou taille, commentaire facultatif. */
export async function addCustomItem(slug: string, viewToken: string | null, formData: FormData): Promise<InventoryResult> {
  const token = await resolveToken(slug, viewToken);
  if (!token) return { ok: false, message: "Votre session a expiré. Rechargez la page." };
  const parsed = customItemSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { ok: false, message: "Vérifiez les informations de l'objet.", fieldErrors: issuesToFields(parsed.error.issues) };
  const hasDims = parsed.data.width_cm !== undefined;
  try {
    await addInventoryItem(token, {
      label: parsed.data.label, category: parsed.data.category, quantity: parsed.data.quantity, comment: parsed.data.comment,
      ...(hasDims ? { width_cm: parsed.data.width_cm, depth_cm: parsed.data.depth_cm, height_cm: parsed.data.height_cm } : { size: parsed.data.size }),
    });
  } catch (error) {
    return failed(error, "addCustomItem");
  }
  refresh(slug, viewToken);
  return { ok: true, message: `« ${parsed.data.label} » ajouté.` };
}

/** Nouvelle quantité ; 0 retire l'objet (marqué retiré, jamais effacé). */
export async function changeQuantity(slug: string, viewToken: string | null, itemId: string, quantity: number): Promise<InventoryResult> {
  const token = await resolveToken(slug, viewToken);
  if (!token) return { ok: false, message: "Votre session a expiré. Rechargez la page." };
  if (!UUID.test(itemId) || !Number.isInteger(quantity) || quantity < 0 || quantity > 999) return { ok: false, message: "Quantité invalide (0 à 999)." };
  try {
    if (quantity === 0) await removeInventoryItem(token, itemId);
    else await setInventoryQuantity(token, itemId, quantity);
  } catch (error) {
    return failed(error, "changeQuantity");
  }
  refresh(slug, viewToken);
  return { ok: true };
}
