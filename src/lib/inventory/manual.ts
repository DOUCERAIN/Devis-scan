/**
 * Inventaire manuel du particulier : catégories affichées, correspondance avec les catégories du
 * catalogue mobilier, tailles approximatives et recherche. Module pur (testé par node --test).
 *
 * Volumes : jamais inventés ici. Le volume retenu est calculé en base (private.customer_item_volume) :
 * volume du catalogue, sinon dimensions × coefficient, sinon volume catalogue d'un objet de taille comparable.
 */

export const MANUAL_CATEGORIES = [
  { key: "salon", label: "Salon", catalog: ["salon"] },
  { key: "chambres", label: "Chambres", catalog: ["chambre"] },
  { key: "cuisine", label: "Cuisine", catalog: ["cuisine", "electromenager"] },
  { key: "salle_de_bain", label: "Salle de bain", catalog: ["salle_de_bain"] },
  { key: "bureau", label: "Bureau", catalog: ["bureau"] },
  { key: "garage_cave", label: "Garage et cave", catalog: ["garage_cave", "jardin", "sport_loisirs"] },
  { key: "autres", label: "Autres espaces", catalog: ["entree", "cartons", "volumineux"] },
] as const;

export type ManualCategory = (typeof MANUAL_CATEGORIES)[number]["key"];
export const MANUAL_CATEGORY_KEYS = MANUAL_CATEGORIES.map((c) => c.key) as [ManualCategory, ...ManualCategory[]];

export function categoryLabel(key: string): string {
  return MANUAL_CATEGORIES.find((c) => c.key === key)?.label ?? "Autres espaces";
}

/** Catégorie affichée pour une catégorie du catalogue (les catégories inconnues vont dans « Autres espaces »). */
export function manualCategoryFor(catalogCategory: string): ManualCategory {
  return MANUAL_CATEGORIES.find((c) => (c.catalog as readonly string[]).includes(catalogCategory))?.key ?? "autres";
}

/** Tailles proposées quand ni le catalogue ni des dimensions ne donnent de volume (objet comparable en base). */
export const SIZE_CLASSES = [
  { value: "small", label: "Petit", hint: "comme un carton" },
  { value: "medium", label: "Moyen", hint: "comme un fauteuil" },
  { value: "large", label: "Grand", hint: "comme une armoire 2 portes" },
  { value: "xlarge", label: "Très grand", hint: "comme un canapé 3 places" },
] as const;
export type SizeClass = (typeof SIZE_CLASSES)[number]["value"];
export const SIZE_CLASS_VALUES = SIZE_CLASSES.map((s) => s.value) as [SizeClass, ...SizeClass[]];

export type CatalogChoice = { id: string; name: string; category: string; synonyms: string[]; volume: number | null };

/** Texte comparable : minuscules, sans accents ni ponctuation. */
export function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Recherche dans le catalogue (nom et synonymes), tous les mots doivent être présents ; nom exact en premier. */
export function searchCatalog(items: readonly CatalogChoice[], query: string, limit = 20): CatalogChoice[] {
  const words = normalize(query).split(" ").filter(Boolean);
  if (words.length === 0) return [];
  const scored: { item: CatalogChoice; score: number }[] = [];
  for (const item of items) {
    const name = normalize(item.name);
    const haystack = [name, ...item.synonyms.map(normalize)].join(" | ");
    if (!words.every((w) => haystack.includes(w))) continue;
    const score = name === words.join(" ") ? 0 : name.startsWith(words[0]) ? 1 : words.every((w) => name.includes(w)) ? 2 : 3;
    scored.push({ item, score });
  }
  return scored
    .sort((a, b) => a.score - b.score || a.item.name.localeCompare(b.item.name, "fr"))
    .slice(0, limit)
    .map((s) => s.item);
}

/** Objets du catalogue d'une catégorie affichée, par ordre alphabétique. */
export function catalogForCategory(items: readonly CatalogChoice[], category: ManualCategory): CatalogChoice[] {
  const wanted = MANUAL_CATEGORIES.find((c) => c.key === category)?.catalog as readonly string[] | undefined;
  return items.filter((i) => wanted?.includes(i.category)).sort((a, b) => a.name.localeCompare(b.name, "fr"));
}

/** Avertissement accepté par le client qui saisit lui-même son inventaire (variante sans vidéos). */
export const MANUAL_INVENTORY_WARNING =
  "Merci de vérifier attentivement votre inventaire et de répondre avec honnêteté. Votre inventaire sera ensuite vérifié par un professionnel du déménagement. Toute différence constatée lors de cette vérification pourra entraîner une modification du volume estimé et du montant de votre devis.";
