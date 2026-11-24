import type { InventoryItem } from "./volume.ts";

/**
 * Inventaire FICTIF, utilisé uniquement pour illustrer l'interface
 * (page d'accueil et page de charte). Toujours présenté comme un exemple.
 */
export const SAMPLE_INVENTORY: InventoryItem[] = [
  { id: "s1", name: "Lit double 160", room: "Chambre", quantity: 1, unitVolumeM3: 1.4, source: "ai", confidence: 0.94 },
  { id: "s2", name: "Armoire 2 portes", room: "Chambre", quantity: 1, unitVolumeM3: 1.6, source: "ai", confidence: 0.68 },
  { id: "s3", name: "Commode", room: "Chambre", quantity: 1, unitVolumeM3: 0.5, source: "ai", confidence: 0.88, possibleDuplicate: true },
  { id: "s4", name: "Canapé 3 places", room: "Salon", quantity: 1, unitVolumeM3: 1.5, source: "ai", confidence: 0.91 },
  { id: "s5", name: "Table repas", room: "Salon", quantity: 1, unitVolumeM3: 0.5, source: "ai", confidence: 0.86 },
  { id: "s6", name: "Chaise", room: "Salon", quantity: 4, unitVolumeM3: 0.15, source: "ai", confidence: 0.79 },
  { id: "s7", name: "Objet couvert d'un drap", room: "Cave", quantity: 1, unitVolumeM3: 0.8, source: "ai", confidence: 0.38 },
  { id: "s8", name: "Carton standard", room: "Cave", quantity: 25, unitVolumeM3: 0.1, source: "manual" },
];
