/**
 * Pièces de l'inventaire visuel (parcours v3). Chaque onglet correspond à une catégorie d'inventaire en base
 * (rooms.room_type = 'inv:<clé>', ou 'inv:<clé>:<n>' pour une pièce supplémentaire comme « Chambre 2 ») et
 * aux catégories du catalogue mobilier proposées dans sa liste. Aucun volume ni aucune catégorie parallèle :
 * les objets restent ceux de public.furniture_catalog. Module pur (node --test).
 */
import type { ManualCategory } from "./manual.ts";

export type RoomTabKey = ManualCategory | "entree";

export type RoomTab = {
  key: RoomTabKey;
  label: string;
  /** Catégories du catalogue proposées dans la liste déroulante de la pièce (la recherche couvre tout). */
  catalog: readonly string[];
};

export const ROOM_TABS: readonly RoomTab[] = [
  { key: "salon", label: "Salon", catalog: ["salon"] },
  { key: "cuisine", label: "Cuisine", catalog: ["cuisine", "electromenager"] },
  { key: "chambres", label: "Chambre", catalog: ["chambre"] },
  { key: "salle_de_bain", label: "Salle de bain", catalog: ["salle_de_bain"] },
  { key: "bureau", label: "Bureau", catalog: ["bureau"] },
  { key: "entree", label: "Entrée / couloir", catalog: ["entree"] },
  { key: "garage_cave", label: "Garage / cave", catalog: ["garage_cave", "jardin", "sport_loisirs"] },
  { key: "autres", label: "Autre pièce", catalog: ["volumineux", "cartons", "jardin", "sport_loisirs"] },
] as const;

export const ROOM_TAB_KEYS = ROOM_TABS.map((t) => t.key) as [RoomTabKey, ...RoomTabKey[]];

/** Identifiant du carton standard (volume du catalogue existant, inchangé). */
export const BOX_CATALOG_KEY = "carton-standard";
/** Objets comptés comme des cartons déjà faits quand l'analyse les repère. */
export const BOX_LIKE_KEYS = new Set([BOX_CATALOG_KEY, "carton-livres", "carton-penderie", "lot-10-cartons"]);

export function tabFor(key: string): RoomTab | undefined {
  return ROOM_TABS.find((t) => t.key === key);
}

/** Catégorie d'onglet d'une catégorie du catalogue (la première pièce qui la propose). */
export function tabForCatalogCategory(category: string | null | undefined): RoomTabKey {
  return ROOM_TABS.find((t) => category && t.catalog.includes(category))?.key ?? "autres";
}

/** Base d'une catégorie de pièce en base : 'chambres:2' → 'chambres'. */
export function baseCategory(roomCategory: string | null | undefined): string | null {
  if (!roomCategory) return null;
  return roomCategory.split(":")[0] || null;
}

/** Nom proposé pour une pièce supplémentaire : « Chambre 2 », « Chambre 3 »… */
export function nextRoomName(tab: RoomTab, existingNames: readonly string[]): string {
  const taken = new Set(existingNames.map((n) => n.trim().toLowerCase()));
  for (let n = 2; n < 100; n++) {
    const name = `${tab.label} ${n}`;
    if (!taken.has(name.toLowerCase())) return name;
  }
  return `${tab.label} supplémentaire`;
}

export type InventoryRoom = { id: string; name: string; category: string | null };

/** Onglet affiché : une pièce de base (sans id tant qu'aucun objet n'y est ajouté) ou une pièce supplémentaire. */
export type DisplayRoom = { tabKey: string; base: RoomTabKey; label: string; roomId: string | null; extra: boolean };

/** Onglets : les 8 pièces de base, puis les pièces supplémentaires dans l'ordre de création. */
export function displayRooms(rooms: readonly InventoryRoom[]): DisplayRoom[] {
  const out: DisplayRoom[] = ROOM_TABS.map((t) => ({
    tabKey: t.key, base: t.key, label: t.label, extra: false,
    roomId: rooms.find((r) => r.category === t.key)?.id ?? null,
  }));
  for (const r of rooms) {
    const parts = r.category?.split(":") ?? [];
    const tab = parts.length === 2 ? tabFor(parts[0]) : undefined;
    if (tab) out.push({ tabKey: `room:${r.id}`, base: tab.key, label: r.name, roomId: r.id, extra: true });
  }
  return out;
}

type ItemLike = { room_id: string | null; catalog_key: string | null; category: string | null };

/**
 * Onglet d'un objet : sa pièce d'inventaire s'il y a été ajouté ; sinon (objet repéré par l'analyse dans
 * « Mon logement » ou dans une pièce filmée de l'ancien parcours) la pièce de sa catégorie du catalogue.
 * Retourne null pour les cartons supplémentaires (étape dédiée).
 */
export function tabKeyForItem(item: ItemLike, rooms: readonly InventoryRoom[], catalogCategory: (key: string) => string | null | undefined, display: readonly DisplayRoom[]): string | null {
  const room = item.room_id ? rooms.find((r) => r.id === item.room_id) : undefined;
  if (room?.category === "cartons") return null;
  if (room?.category) {
    const exact = display.find((d) => d.roomId === room.id);
    if (exact) return exact.tabKey;
    const base = baseCategory(room.category);
    if (base && tabFor(base)) return base;
  }
  return tabForCatalogCategory(item.catalog_key ? catalogCategory(item.catalog_key) : item.category);
}

/** Cartons déjà repérés par l'analyse (objets de l'IA de type carton), comptés dans le volume. */
export function detectedBoxes(items: readonly { source: string; catalog_key: string | null; quantity: number }[]): number {
  return items.filter((i) => i.source === "ai" && i.catalog_key !== null && BOX_LIKE_KEYS.has(i.catalog_key))
    .reduce((n, i) => n + (i.catalog_key === "lot-10-cartons" ? 10 * i.quantity : i.quantity), 0);
}

/**
 * Saisie d'une quantité au clavier : entier de 0 à `max`, champ vide toléré pendant la saisie (null), texte,
 * signe ou décimale refusés. Retourne { ok: false } si la valeur doit être corrigée à la validation.
 */
export function parseQuantityInput(raw: string, max = 999): { ok: true; value: number | null } | { ok: false; message: string } {
  const text = raw.trim();
  if (text === "") return { ok: true, value: null };
  if (!/^\d+$/.test(text)) return { ok: false, message: "Saisissez un nombre entier (0, 1, 2…)." };
  const value = Number(text);
  if (value > max) return { ok: false, message: `${max} au maximum.` };
  return { ok: true, value };
}
