import type { Catalogue } from "./catalogue.ts";
import type { ObjetIA, ReponsePiece } from "./contrat.ts";
import { VERSION_CONTRAT } from "./contrat.ts";

/**
 * Compatibilité avec les réponses IA V1 (format actuel de src/lib/ai/output.ts) — PROTOTYPE.
 * Une réponse V1 conservée dans `analysis_runs.raw_output` peut être relue au format 2.0 : l'identifiant de
 * l'ancien catalogue (134 références) est conservé dans `reference_id` et converti par la résolution grâce aux
 * alias historiques (statut « alias_historique »). Rien n'est perdu ni réinterprété.
 */
export type ObjetV1 = {
  label: string;
  catalog_id: string;
  quantity: number;
  confidence: number;
  visibility: "visible" | "partial" | "uncertain";
  image_indexes: number[];
  dimensions_cm: { width: number; depth: number; height: number } | null;
  is_fragile: boolean;
  needs_disassembly: boolean;
  location_in_room?: string;
  distinctive_features?: string;
  identity_doubt?: { other_entry_index: number | null; other_room: boolean; reason: string } | null;
  notes: string;
};
export type ReponseV1 = { objects: ObjetV1[]; room_notes: string };

export function depuisV1(v1: ReponseV1, cat: Catalogue): ReponsePiece {
  const objets: ObjetIA[] = v1.objects.map((o, i) => {
    const autre = o.catalog_id.trim().toLowerCase() === "autre" || !o.catalog_id.trim();
    const alias = cat.alias_historiques[o.catalog_id];
    const principale = alias?.reference_principale ? cat.references.find((r) => r.id === alias.reference_principale) : undefined;
    return {
      id_objet: `v1-${i}`,
      libelle: o.label,
      famille_id: principale?.famille_id ?? "DIV",
      sous_categorie_id: null,
      reference_id: autre ? null : o.catalog_id,
      statut_reference: autre ? "inconnue" : o.visibility === "uncertain" ? "a_confirmer" : "trouvee",
      alternatives: [],
      quantite: o.quantity,
      exemplaires: [{ id_exemplaire: `v1-${i}-1`, images: o.image_indexes, cadres: [], position_piece: o.location_in_room ?? "", signes_distinctifs: o.distinctive_features ?? "" }],
      caracteristiques: { nb_portes: null, nb_places: null, nb_tiroirs: null, largeur_couchage_cm: null, diagonale_pouces: null, forme: null, materiau: null, portes_coulissantes: null, extensible: null, demontable_apparent: o.needs_disassembly, fragile: o.is_fragile, ancien: null },
      dimensions_apparentes_cm: o.dimensions_cm ? { hauteur: o.dimensions_cm.height, largeur: o.dimensions_cm.width, profondeur: o.dimensions_cm.depth } : null,
      indices: o.notes ? [o.notes.slice(0, 160)] : [],
      confiance: o.confidence,
      motif_incertitude: o.visibility === "uncertain" ? "visibilité incertaine (réponse V1)" : null,
      doute_identite: o.identity_doubt
        ? { autre_objet_id: o.identity_doubt.other_entry_index === null ? null : `v1-${o.identity_doubt.other_entry_index}`, autre_piece: o.identity_doubt.other_room, raison: o.identity_doubt.reason }
        : null,
    };
  });
  return { version_contrat: VERSION_CONTRAT, objets, remarques_piece: v1.room_notes.slice(0, 1000) };
}
