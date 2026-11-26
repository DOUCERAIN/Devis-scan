import type { Catalogue, ReferenceIndex } from "./catalogue.ts";
import { parId } from "./catalogue.ts";
import type { ObjetIA, ReponsePiece } from "./contrat.ts";

/**
 * Résolution côté SERVEUR — PROTOTYPE.
 * Transforme la réponse (déjà validée par le contrat) en éléments d'inventaire en lisant le catalogue. Le modèle
 * ne fournit jamais le volume : il est lu ici, et seulement ici. Le résultat ne dépend que de la réponse
 * normalisée et de la version du catalogue : il est identique quel que soit le fournisseur.
 */
export const SEUIL_SUR = 0.85;
export const SEUIL_INCERTAIN = 0.6;

export type StatutResolution =
  | "trouvee" // identifiant valide, retenu
  | "a_confirmer" // doute signalé par le modèle, confiance faible ou incohérence : décision humaine
  | "inconnue" // aucune référence suffisamment proche : dimensions à saisir
  | "alias_historique" // identifiant de l'ancien catalogue (réponses V1) converti
  | "remplacee" // identifiant retiré ou renommé dans une version ultérieure du catalogue
  | "identifiant_inexistant"; // identifiant inventé par le modèle : refusé, traité comme inconnu

export type VolumeCatalogue = {
  statut: "reference_geometrique" | "dimensions_partielles" | "non_disponible";
  geometrique_unitaire_m3: { mediane: number; q1: number | null; q3: number | null } | null;
  dimensions_medianes_cm: ReferenceIndex["dimensions_medianes_cm"] | null;
  dimensions_partielles: Record<string, number> | null;
  demenagement_reference_unitaire_m3: number | null;
  demenagement_origine: string;
  convention: string;
  fiabilite: ReferenceIndex["fiabilite"];
  nb_modeles_independants: number;
  avertissements: string[];
};

export type ElementResolu = {
  id_objet: string;
  libelle: string;
  quantite: number;
  statut: StatutResolution;
  reference_id: string | null;
  reference_demandee: string | null;
  sous_categorie_id: string | null;
  famille_id: string | null;
  niveau_confiance: "sûr" | "à vérifier" | "incertain";
  confirmation_requise: boolean;
  motifs: string[];
  alternatives: string[];
  volume: VolumeCatalogue;
  /** Indicatives, jamais utilisées pour le volume (affichées au déménageur). */
  dimensions_apparentes_cm: ObjetIA["dimensions_apparentes_cm"];
  exemplaires: ObjetIA["exemplaires"];
};

const volumeVide = (motif: string): VolumeCatalogue => ({
  statut: "non_disponible", geometrique_unitaire_m3: null, dimensions_medianes_cm: null, dimensions_partielles: null,
  demenagement_reference_unitaire_m3: null, demenagement_origine: "", convention: "", fiabilite: "non vérifiée", nb_modeles_independants: 0, avertissements: [motif],
});

export function volumeDepuisCatalogue(r: ReferenceIndex): VolumeCatalogue {
  const av: string[] = [];
  if (r.transport.avertissement_volume) av.push(r.transport.avertissement_volume);
  if (r.fiabilite === "faible") av.push(`fiabilité faible (${r.nb_modeles_independants} modèle(s)) : estimation provisoire`);
  if (r.mesurabilite !== "mesurable") av.push(`mesurabilité : ${r.mesurabilite}`);
  const g = r.volume_geometrique_m3;
  const statut = r.couverture_dimensions === "complète" && g.mediane !== null ? "reference_geometrique" : r.couverture_dimensions === "partielle" ? "dimensions_partielles" : "non_disponible";
  if (statut === "dimensions_partielles") av.push("dimensions partielles seulement : aucun volume géométrique de référence (dimension manquante jamais estimée)");
  if (statut === "non_disponible") av.push("aucune dimension de référence : dimensions à saisir par le déménageur");
  return {
    statut,
    geometrique_unitaire_m3: statut === "reference_geometrique" ? { mediane: g.mediane as number, q1: g.q1, q3: g.q3 } : null,
    dimensions_medianes_cm: statut === "reference_geometrique" ? r.dimensions_medianes_cm : null,
    dimensions_partielles: statut === "dimensions_partielles" ? r.dimensions_partielles : null,
    demenagement_reference_unitaire_m3: r.volume_demenagement.reference_m3,
    demenagement_origine: r.volume_demenagement.origine,
    convention: "volume géométrique = boîte englobante du meuble monté ; volume de déménagement = convention métier, non dérivée automatiquement",
    fiabilite: r.fiabilite,
    nb_modeles_independants: r.nb_modeles_independants,
    avertissements: av,
  };
}

function niveau(c: number): ElementResolu["niveau_confiance"] {
  return c >= SEUIL_SUR ? "sûr" : c >= SEUIL_INCERTAIN ? "à vérifier" : "incertain";
}

/** Identifiant demandé → référence du catalogue courant (remplacements, puis alias historiques). */
export function trouverReference(cat: Catalogue, id: string | null): { ref: ReferenceIndex | null; statut: StatutResolution | null; motif?: string } {
  if (!id) return { ref: null, statut: null };
  const idx = parId(cat);
  if (idx.has(id)) return { ref: idx.get(id)!, statut: null };
  const remplace = cat.remplacements?.[id];
  if (remplace && idx.has(remplace)) return { ref: idx.get(remplace)!, statut: "remplacee", motif: `identifiant ${id} remplacé par ${remplace} dans le catalogue ${cat.version_catalogue}` };
  const alias = cat.alias_historiques[id];
  if (alias?.reference_principale && idx.has(alias.reference_principale)) return { ref: idx.get(alias.reference_principale)!, statut: "alias_historique", motif: `identifiant historique ${id} → ${alias.reference_principale}` };
  return { ref: null, statut: "identifiant_inexistant", motif: `identifiant « ${id} » absent du catalogue ${cat.version_catalogue} : refusé` };
}

export function resoudreObjet(cat: Catalogue, o: ObjetIA, candidatesProposees?: string[]): ElementResolu {
  const motifs: string[] = [];
  let statut: StatutResolution = o.statut_reference;
  const t = trouverReference(cat, o.statut_reference === "inconnue" ? null : o.reference_id);
  const ref = t.ref;
  if (t.statut) {
    statut = t.statut === "identifiant_inexistant" ? "identifiant_inexistant" : t.statut;
    if (t.motif) motifs.push(t.motif);
  }
  if (o.statut_reference !== "inconnue" && !o.reference_id) {
    statut = "inconnue";
    motifs.push("statut « trouvée » sans identifiant : traité comme inconnu");
  }
  if (ref) {
    const base = ref.variante_de ?? ref.id;
    if (o.sous_categorie_id && o.sous_categorie_id !== base && o.sous_categorie_id !== ref.id && statut !== "alias_historique" && statut !== "remplacee") {
      motifs.push(`sous-catégorie déclarée ${o.sous_categorie_id} incohérente avec la référence ${ref.id}`);
      statut = "a_confirmer";
    }
    if (o.famille_id && o.famille_id !== ref.famille_id && statut !== "alias_historique") {
      motifs.push(`famille déclarée ${o.famille_id} différente de celle de la référence (${ref.famille_id})`);
      statut = "a_confirmer";
    }
    if (candidatesProposees && !candidatesProposees.includes(ref.id)) motifs.push("référence choisie hors des candidates proposées (acceptée car elle existe, à vérifier)");
  }
  if (o.motif_incertitude) motifs.push(o.motif_incertitude);
  const confirmation =
    statut !== "trouvee" && statut !== "alias_historique" && statut !== "remplacee" ? true : o.confiance < SEUIL_INCERTAIN || !!o.doute_identite || motifs.some((m) => m.includes("hors des candidates"));
  return {
    id_objet: o.id_objet,
    libelle: o.libelle,
    quantite: o.quantite,
    statut,
    reference_id: ref?.id ?? null,
    reference_demandee: o.reference_id,
    sous_categorie_id: ref ? ref.variante_de ?? ref.id : null,
    famille_id: ref?.famille_id ?? (o.famille_id || null),
    niveau_confiance: niveau(statut === "identifiant_inexistant" ? Math.min(o.confiance, 0.59) : o.confiance),
    confirmation_requise: confirmation,
    motifs,
    alternatives: o.alternatives.map((a) => a.reference_id).filter((id) => parId(cat).has(id)),
    volume: ref ? volumeDepuisCatalogue(ref) : volumeVide("référence inconnue : dimensions à saisir par le déménageur, aucun volume inventé"),
    dimensions_apparentes_cm: o.dimensions_apparentes_cm,
    exemplaires: o.exemplaires,
  };
}

export function resoudrePiece(cat: Catalogue, reponse: ReponsePiece, candidates?: Record<string, string[]>): ElementResolu[] {
  return reponse.objets.map((o) => resoudreObjet(cat, o, candidates?.[o.id_objet]));
}

/** Totaux de la pièce, en séparant toujours géométrique et déménagement. */
export function totaux(elements: ElementResolu[]) {
  const geo = elements.reduce((s, e) => s + (e.volume.geometrique_unitaire_m3?.mediane ?? 0) * e.quantite, 0);
  const dem = elements.reduce((s, e) => s + (e.volume.demenagement_reference_unitaire_m3 ?? 0) * e.quantite, 0);
  return {
    volume_geometrique_m3: Math.round(geo * 1000) / 1000,
    volume_demenagement_reference_m3: Math.round(dem * 1000) / 1000,
    elements_sans_volume: elements.filter((e) => e.volume.statut !== "reference_geometrique").map((e) => e.id_objet),
    elements_a_confirmer: elements.filter((e) => e.confirmation_requise).map((e) => e.id_objet),
  };
}
