import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/**
 * Index du catalogue (généré par construire_index.py depuis data/catalogue-v5/) — PROTOTYPE.
 * Le catalogue reste la seule source des identifiants, dimensions et volumes.
 */
export type Plage = [number | null, number | null];
export type ReferenceIndex = {
  id: string;
  nom: string;
  famille_id: string;
  famille: string;
  variante_de: string | null;
  variantes: string[];
  synonymes: string[];
  mots_cles: string[];
  caracteristiques_discriminantes: string;
  description: string;
  criteres: Partial<Record<"nb_portes" | "nb_places" | "nb_tiroirs" | "largeur_couchage_cm" | "largeur_cm" | "diagonale_pouces" | "longueur_cm" | "hauteur_cm" | "profondeur_cm", Plage>>;
  plage_variante_m3: [number, number] | null;
  niveau_pertinence: 1 | 2 | 3 | 4;
  mesurabilite: "mesurable" | "méthode spécifique" | "non directement mesurable";
  couverture_dimensions: "complète" | "partielle" | "aucune";
  fiabilite: "élevée" | "moyenne" | "faible" | "non vérifiée";
  nb_modeles_independants: number;
  nb_sources_independantes: number;
  dimensions_medianes_cm: { hauteur: number | null; largeur: number | null; profondeur: number | null };
  dimensions_partielles: Record<string, number>;
  volume_geometrique_m3: { mediane: number | null; q1: number | null; q3: number | null; min: number | null; max: number | null };
  volume_demenagement: { reference_m3: number | null; origine: string; facteur_conversion: number | null; convention: string };
  transport: { demontable_ou_pliable: boolean; empilable: boolean; remarque: string; avertissement_volume: string };
  references_anciennes: string[];
};
export type Alias = { nom: string; synonymes: string[]; reference_principale: string | null; references_liees: string[] };
export type Catalogue = {
  version_catalogue: string;
  empreinte_catalogue_sha256: string;
  familles: { identifiant: string; nom: string }[];
  references: ReferenceIndex[];
  alias_historiques: Record<string, Alias>;
  /** Renommages ou retraits ultérieurs : ancien identifiant → nouvel identifiant (vide en v5). */
  remplacements?: Record<string, string>;
};

export function chargerCatalogue(chemin = fileURLToPath(new URL("./index_catalogue_v5.json", import.meta.url))): Catalogue {
  return JSON.parse(readFileSync(chemin, "utf8")) as Catalogue;
}

export function parId(cat: Catalogue): Map<string, ReferenceIndex> {
  return new Map(cat.references.map((r) => [r.id, r]));
}
