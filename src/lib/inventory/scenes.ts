/**
 * Illustrations interactives de l'inventaire visuel : pour chaque pièce, les objets dessinés, leur zone
 * cliquable (en unités du dessin, viewBox SCENE_WIDTH × SCENE_HEIGHT) et l'identifiant EXACT du catalogue
 * (public.furniture_catalog) ajouté au clic. Le dessin de chaque forme est dans
 * src/components/customer/illustrations/ ; ce module reste pur pour être testé (node --test) :
 * identifiants existants, zones dans le cadre, sans chevauchement.
 *
 * Ajouter une pièce : une entrée ici (et une forme de dessin si besoin). Aucun volume n'est défini ici.
 */
import type { RoomTabKey } from "./rooms.ts";

export const SCENE_WIDTH = 480;
export const SCENE_HEIGHT = 270;
/** Ligne du sol (bas des meubles posés). */
export const FLOOR_Y = 200;

/** Formes dessinées (une forme peut servir à plusieurs objets du catalogue). */
export type Shape =
  | "sofa" | "armchair" | "coffee-table" | "tv-stand" | "tv" | "bookcase" | "floor-lamp" | "table-lamp" | "plant" | "frame" | "pouf"
  | "fridge" | "dishwasher" | "washer" | "dryer" | "microwave" | "kettle" | "dining-table" | "chair" | "trolley"
  | "wardrobe" | "bed" | "nightstand" | "dresser" | "mirror"
  | "vanity" | "column" | "basket" | "shelf-unit"
  | "desk" | "office-chair" | "drawer-unit" | "shelf"
  | "coat-rack" | "shoe-cabinet" | "console" | "bench"
  | "metal-shelf" | "bike" | "ladder" | "suitcase" | "crate" | "mower"
  | "piano" | "safe" | "exercise-bike" | "aquarium";

export type SceneObject = {
  /** Identifiant exact de public.furniture_catalog. */
  catalogKey: string;
  shape: Shape;
  /** Zone cliquable [x, y, largeur, hauteur] ; le dessin s'y inscrit. */
  box: readonly [number, number, number, number];
};

export type Scene = { title: string; objects: readonly SceneObject[] };

const o = (catalogKey: string, shape: Shape, x: number, y: number, w: number, h: number): SceneObject => ({ catalogKey, shape, box: [x, y, w, h] });

export const SCENES: Record<RoomTabKey, Scene> = {
  salon: {
    title: "Illustration du salon",
    objects: [
      o("lampadaire", "floor-lamp", 14, 64, 34, 136),
      o("tableau-cadre", "frame", 92, 34, 78, 56),
      o("canape-3-places", "sofa", 54, 118, 160, 82),
      o("fauteuil", "armchair", 222, 130, 66, 70),
      o("plante-grande", "plant", 294, 112, 40, 88),
      o("television", "tv", 352, 86, 100, 64),
      o("meuble-tv", "tv-stand", 342, 156, 124, 44),
      o("table-basse", "coffee-table", 70, 210, 120, 40),
      o("pouf", "pouf", 214, 214, 56, 40),
    ],
  },
  cuisine: {
    title: "Illustration de la cuisine",
    objects: [
      o("refrigerateur", "fridge", 14, 46, 72, 154),
      o("petit-electromenager", "kettle", 100, 92, 48, 38),
      o("lave-vaisselle", "dishwasher", 92, 134, 66, 66),
      o("micro-ondes", "microwave", 164, 90, 64, 40),
      o("lave-linge", "washer", 164, 134, 66, 66),
      o("chaise", "chair", 244, 116, 40, 84),
      o("table-a-manger-4", "dining-table", 288, 138, 120, 62),
      o("desserte-cuisine", "trolley", 422, 122, 46, 78),
    ],
  },
  chambres: {
    title: "Illustration de la chambre",
    objects: [
      o("armoire-2-portes", "wardrobe", 14, 36, 104, 164),
      o("lampe-a-poser", "table-lamp", 126, 112, 40, 40),
      o("table-de-chevet", "nightstand", 124, 156, 44, 44),
      o("lit-double", "bed", 172, 112, 176, 88),
      o("miroir-mural", "mirror", 380, 34, 64, 80),
      o("commode", "dresser", 360, 126, 104, 74),
    ],
  },
  salle_de_bain: {
    title: "Illustration de la salle de bain",
    objects: [
      o("miroir-mural", "mirror", 34, 28, 76, 80),
      o("meuble-vasque", "vanity", 18, 116, 112, 84),
      o("colonne-salle-de-bain", "column", 142, 46, 52, 154),
      o("seche-linge", "dryer", 206, 60, 68, 66),
      o("lave-linge", "washer", 206, 132, 68, 68),
      o("panier-a-linge", "basket", 288, 150, 46, 50),
      o("etagere-salle-de-bain", "shelf-unit", 352, 50, 80, 150),
    ],
  },
  bureau: {
    title: "Illustration du bureau",
    objects: [
      o("lampe-a-poser", "table-lamp", 40, 78, 40, 40),
      o("bureau", "desk", 24, 122, 152, 78),
      o("caisson-de-bureau", "drawer-unit", 182, 146, 46, 54),
      o("chaise-de-bureau", "office-chair", 234, 102, 62, 98),
      o("etagere", "shelf", 308, 40, 72, 160),
      o("bibliotheque", "bookcase", 390, 40, 76, 160),
    ],
  },
  entree: {
    title: "Illustration de l'entrée",
    objects: [
      o("portemanteau", "coat-rack", 18, 30, 62, 170),
      o("meuble-a-chaussures", "shoe-cabinet", 92, 136, 104, 64),
      o("miroir-mural", "mirror", 240, 32, 68, 86),
      o("console", "console", 212, 130, 124, 70),
      o("banc-entree", "bench", 352, 152, 112, 48),
    ],
  },
  garage_cave: {
    title: "Illustration du garage ou de la cave",
    objects: [
      o("etagere-metallique", "metal-shelf", 14, 36, 92, 164),
      o("velo", "bike", 114, 116, 124, 84),
      o("echelle", "ladder", 246, 28, 44, 172),
      o("valise", "suitcase", 300, 140, 44, 60),
      o("caisse-plastique", "crate", 352, 162, 54, 38),
      o("tondeuse", "mower", 410, 140, 62, 60),
    ],
  },
  autres: {
    title: "Illustration d'une autre pièce",
    objects: [
      o("piano-droit", "piano", 16, 76, 136, 124),
      o("coffre-fort", "safe", 162, 126, 64, 74),
      o("velo-appartement", "exercise-bike", 236, 96, 92, 104),
      o("aquarium", "aquarium", 338, 92, 128, 108),
    ],
  },
};

/** Identifiants du catalogue présents sur l'illustration d'une pièce. */
export function sceneKeys(tab: RoomTabKey): string[] {
  return [...new Set(SCENES[tab].objects.map((x) => x.catalogKey))];
}
