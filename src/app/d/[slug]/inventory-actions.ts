"use server";

import { isExpiredSession, publicErrorMessage } from "@/lib/public-request/errors";
import { readDraftToken } from "@/lib/public-request/session";
import { addInventoryItem, addInventoryRoom, getCustomerCatalog, getPublicCompany, readInventory, removeInventoryItem, setExtraBoxes, setInventoryQuantity, type PublicInventory } from "@/lib/public-request/service";
import { tabFor } from "@/lib/inventory/rooms";
import { catalogItemSchema, customItemSchema } from "@/lib/validation/public-request";
import { formToObject } from "@/lib/form-data";

/**
 * Inventaire saisi ou corrigé par le client. Le jeton vient du cookie du brouillon (inventaire manuel)
 * ou du lien de suivi (inventaire de l'analyse à valider) ; la base vérifie à chaque appel que la demande
 * accepte encore des modifications et que l'objet lui appartient.
 *
 * Fluidité (parcours v3) : aucune page n'est recalculée après une modification. L'écran est mis à jour tout
 * de suite par le navigateur, puis chaque action renvoie l'état enregistré en base (`inventory`), qui fait
 * foi : volumes calculés par la base, identifiants des objets créés.
 */

export type InventorySnapshot = Pick<PublicInventory, "rooms" | "items" | "extra_boxes">;
export type InventoryResult =
  | { ok: true; message?: string; id?: string; inventory: InventorySnapshot | null }
  | { ok: false; message: string; fieldErrors?: Record<string, string>; inventory?: InventorySnapshot | null };

const HEX64 = /^[0-9a-f]{64}$/;
const UUID = /^[0-9a-f-]{36}$/;

async function resolveToken(slug: string, viewToken: string | null): Promise<string | null> {
  if (viewToken) return HEX64.test(viewToken) ? viewToken : null;
  const company = await getPublicCompany(slug);
  if (!company) return null;
  return readDraftToken(company.id);
}

async function snapshot(token: string): Promise<InventorySnapshot | null> {
  const inv = await readInventory(token);
  return inv ? { rooms: inv.rooms, items: inv.items, extra_boxes: inv.extra_boxes } : null;
}

async function failed(token: string, error: unknown, context: string): Promise<InventoryResult> {
  if (isExpiredSession(error)) return { ok: false, message: "Votre session a expiré. Rechargez la page." };
  // L'état enregistré accompagne l'erreur : l'écran se recale sans perdre ce qui est déjà en base.
  return { ok: false, message: publicErrorMessage(error, context), inventory: await snapshot(token).catch(() => null) };
}

function issuesToFields(issues: { path: PropertyKey[]; message: string }[]) {
  const fieldErrors: Record<string, string> = {};
  for (const i of issues) fieldErrors[i.path.join(".")] ??= i.message;
  return fieldErrors;
}

/** Ajoute un objet du catalogue (quantité 1 par défaut). Sans volume de référence : taille demandée. */
export async function addCatalogItem(slug: string, viewToken: string | null, input: { catalog_key: string; category: string; room_id?: string; quantity?: number; size?: string }): Promise<InventoryResult> {
  const token = await resolveToken(slug, viewToken);
  if (!token) return { ok: false, message: "Votre session a expiré. Rechargez la page." };
  const parsed = catalogItemSchema.safeParse({ ...input, quantity: String(input.quantity ?? 1) });
  if (!parsed.success) return { ok: false, message: "Objet invalide.", fieldErrors: issuesToFields(parsed.error.issues) };
  const ref = (await getCustomerCatalog()).find((c) => c.id === parsed.data.catalog_key);
  if (!ref) return { ok: false, message: "Cet objet n'est plus disponible." };
  if (ref.volume === null && !parsed.data.size) return { ok: false, message: "Indiquez une taille approximative pour cet objet.", fieldErrors: { size: "Taille obligatoire." } };
  let id: string;
  try {
    id = await addInventoryItem(token, { ...parsed.data, size: ref.volume === null ? parsed.data.size : undefined });
  } catch (error) {
    return failed(token, error, "addCatalogItem");
  }
  return { ok: true, id, message: `« ${ref.name} » ajouté.`, inventory: await snapshot(token) };
}

/** Objet personnalisé : description obligatoire, quantité, dimensions ou taille, commentaire facultatif. */
export async function addCustomItem(slug: string, viewToken: string | null, formData: FormData): Promise<InventoryResult> {
  const token = await resolveToken(slug, viewToken);
  if (!token) return { ok: false, message: "Votre session a expiré. Rechargez la page." };
  const parsed = customItemSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { ok: false, message: "Vérifiez les informations de l'objet.", fieldErrors: issuesToFields(parsed.error.issues) };
  const hasDims = parsed.data.width_cm !== undefined;
  let id: string;
  try {
    id = await addInventoryItem(token, {
      label: parsed.data.label, category: parsed.data.category, room_id: parsed.data.room_id, quantity: parsed.data.quantity, comment: parsed.data.comment,
      ...(hasDims ? { width_cm: parsed.data.width_cm, depth_cm: parsed.data.depth_cm, height_cm: parsed.data.height_cm } : { size: parsed.data.size }),
    });
  } catch (error) {
    return failed(token, error, "addCustomItem");
  }
  return { ok: true, id, message: `« ${parsed.data.label} » ajouté.`, inventory: await snapshot(token) };
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
    return failed(token, error, "changeQuantity");
  }
  return { ok: true, inventory: await snapshot(token) };
}

/** Étape « cartons » : nombre de cartons supplémentaires (0 accepté), obligatoire avant l'envoi. */
export async function setBoxesAction(slug: string, viewToken: string | null, boxes: number): Promise<InventoryResult> {
  const token = await resolveToken(slug, viewToken);
  if (!token) return { ok: false, message: "Votre session a expiré. Rechargez la page." };
  if (!Number.isInteger(boxes) || boxes < 0 || boxes > 999) return { ok: false, message: "Indiquez un nombre entier de cartons (0 à 999)." };
  try {
    await setExtraBoxes(token, boxes);
  } catch (error) {
    return failed(token, error, "setBoxes");
  }
  return { ok: true, inventory: await snapshot(token) };
}

/** Pièce supplémentaire (Chambre 2, Salle de bain 2…). */
export async function addRoomAction(slug: string, viewToken: string | null, baseCategory: string, name: string): Promise<InventoryResult> {
  const token = await resolveToken(slug, viewToken);
  if (!token) return { ok: false, message: "Votre session a expiré. Rechargez la page." };
  const clean = name.trim().replace(/\s+/g, " ");
  if (!tabFor(baseCategory)) return { ok: false, message: "Type de pièce inconnu." };
  if (clean.length < 1 || clean.length > 80) return { ok: false, message: "Donnez un nom à la pièce (80 caractères au plus)." };
  let id: string;
  try {
    id = await addInventoryRoom(token, baseCategory, clean);
  } catch (error) {
    return failed(token, error, "addRoom");
  }
  return { ok: true, id, inventory: await snapshot(token) };
}

/** Relit l'inventaire enregistré (après une erreur réseau, pour recaler l'écran). */
export async function loadInventoryAction(slug: string, viewToken: string | null): Promise<InventoryResult> {
  const token = await resolveToken(slug, viewToken);
  if (!token) return { ok: false, message: "Votre session a expiré. Rechargez la page." };
  const inventory = await snapshot(token).catch(() => null);
  return inventory ? { ok: true, inventory } : { ok: false, message: "Inventaire momentanément indisponible. Réessayez." };
}
