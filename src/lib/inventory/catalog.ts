/**
 * Volumes de référence des meubles courants, en m³.
 * Repris du prototype (prototype/index.html), à enrichir et à rendre
 * modifiable par chaque entreprise plus tard.
 * `heavy` signale un objet lourd soumis à supplément.
 */
export type CatalogEntry = { volumeM3: number; heavy: boolean };

export const FURNITURE_CATALOG: Record<string, CatalogEntry> = {
  "Canapé 2 places": { volumeM3: 1.0, heavy: false },
  "Canapé 3 places": { volumeM3: 1.5, heavy: false },
  "Méridienne": { volumeM3: 0.8, heavy: false },
  "Fauteuil": { volumeM3: 0.5, heavy: false },
  "Lit double 140": { volumeM3: 1.2, heavy: false },
  "Lit double 160": { volumeM3: 1.4, heavy: false },
  "Lit simple": { volumeM3: 0.8, heavy: false },
  "Sommier": { volumeM3: 0.3, heavy: false },
  "Matelas double": { volumeM3: 0.5, heavy: false },
  "Matelas simple": { volumeM3: 0.3, heavy: false },
  "Armoire 1 porte": { volumeM3: 0.5, heavy: false },
  "Armoire 2 portes": { volumeM3: 0.8, heavy: false },
  "Grande armoire": { volumeM3: 1.2, heavy: false },
  "Commode": { volumeM3: 0.5, heavy: false },
  "Table de nuit": { volumeM3: 0.1, heavy: false },
  "Bureau": { volumeM3: 0.6, heavy: false },
  "Chaise de bureau": { volumeM3: 0.3, heavy: false },
  "Table repas": { volumeM3: 0.5, heavy: false },
  "Chaise": { volumeM3: 0.15, heavy: false },
  "Table basse": { volumeM3: 0.3, heavy: false },
  "Bibliothèque": { volumeM3: 0.6, heavy: false },
  "Étagère": { volumeM3: 0.3, heavy: false },
  "Télévision": { volumeM3: 0.2, heavy: false },
  "Réfrigérateur": { volumeM3: 0.4, heavy: true },
  "Congélateur": { volumeM3: 0.4, heavy: true },
  "Lave-linge": { volumeM3: 0.3, heavy: true },
  "Sèche-linge": { volumeM3: 0.3, heavy: true },
  "Lave-vaisselle": { volumeM3: 0.3, heavy: true },
  "Machine à café": { volumeM3: 0.05, heavy: false },
  "Micro-ondes": { volumeM3: 0.05, heavy: false },
  "Piano droit": { volumeM3: 2.5, heavy: true },
  "Piano à queue": { volumeM3: 5.0, heavy: true },
  "Coffre-fort": { volumeM3: 0.8, heavy: true },
  "Vélo": { volumeM3: 0.5, heavy: false },
  "Vélo d'appartement": { volumeM3: 1.0, heavy: false },
  "Carton standard": { volumeM3: 0.1, heavy: false },
};
