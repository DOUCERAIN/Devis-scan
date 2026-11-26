import type { Catalogue, Plage, ReferenceIndex } from "./catalogue.ts";

/**
 * Recherche des références candidates — PROTOTYPE.
 *
 * Recherche STRUCTURÉE, sans base vectorielle : 515 références tiennent en mémoire et se comparent en moins d'une
 * milliseconde. Le score additionne des indices explicables (chaque point gagné est justifié dans `raisons`) :
 *   1. famille reconnue par le modèle (filtre principal) ;
 *   2. texte : nom, synonymes français, mots-clés multilingues de la taxonomie ;
 *   3. caractéristiques chiffrées : nombre de portes, de places, de tiroirs, largeur de couchage, diagonale ;
 *   4. dimensions apparentes : longueur, hauteur, volume apparent comparé à la plage des variantes ;
 *   5. pertinence pour le déménagement (objets courants favorisés, mobilier ancien seulement si « ancien »).
 * Les sous-catégories « (non précisé) » restent toujours proposées en repli dans la famille.
 */
export type Requete = {
  libelle: string;
  famille_id?: string | null;
  caracteristiques?: Partial<Record<"nb_portes" | "nb_places" | "nb_tiroirs" | "largeur_couchage_cm" | "diagonale_pouces", number | null>> & { ancien?: boolean | null; extensible?: boolean | null };
  dimensions_apparentes_cm?: { hauteur: number; largeur: number; profondeur: number } | null;
};
export const SEUIL_SANS_FAMILLE = 4;
export type Candidate = { id: string; nom: string; score: number; raisons: string[]; reference: ReferenceIndex };

export function normaliser(t: string): string {
  return t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
}
const mots = (t: string) => normaliser(t).split(" ").filter((m) => m.length >= 3);

function dansPlage(v: number, [a, b]: Plage, tolerance = 0): boolean {
  return (a === null || v >= a * (1 - tolerance)) && (b === null || v <= b * (1 + tolerance));
}

function scoreReference(r: ReferenceIndex, q: Requete): { score: number; raisons: string[] } {
  let score = 0;
  const raisons: string[] = [];
  const lib = normaliser(q.libelle);
  const motsLib = new Set(mots(q.libelle));
  // 1. Famille
  if (q.famille_id) {
    if (r.famille_id === q.famille_id) {
      score += 10;
      raisons.push(`famille ${r.famille_id}`);
    } else return { score: -Infinity, raisons };
  }
  // 2. Texte
  const noms = [r.nom, ...r.synonymes].map(normaliser);
  if (noms.some((n) => n === lib)) {
    score += 8;
    raisons.push("nom ou synonyme exact");
  } else {
    const communs = noms.flatMap(mots).filter((m) => motsLib.has(m));
    if (communs.length) {
      score += Math.min(6, 2 * new Set(communs).size);
      raisons.push(`mots communs : ${[...new Set(communs)].join(", ")}`);
    }
  }
  const cles = r.mots_cles.filter((m) => motsLib.has(m));
  if (cles.length) {
    score += Math.min(5, 2 * cles.length);
    raisons.push(`mots-clés : ${cles.slice(0, 4).join(", ")}`);
  }
  // 3. Caractéristiques chiffrées
  const c = q.caracteristiques ?? {};
  for (const k of ["nb_portes", "nb_places", "nb_tiroirs", "largeur_couchage_cm", "diagonale_pouces"] as const) {
    const v = c[k];
    const p = r.criteres[k];
    if (v == null || !p) continue;
    if (dansPlage(v, p)) {
      score += 6;
      raisons.push(`${k} = ${v} compatible`);
    } else {
      score -= 8;
      raisons.push(`${k} = ${v} incompatible`);
    }
  }
  // 4. Dimensions apparentes
  const d = q.dimensions_apparentes_cm;
  if (d) {
    const long = Math.max(d.largeur, d.profondeur);
    if (r.criteres.longueur_cm) score += dansPlage(long, r.criteres.longueur_cm, 0.05) ? 3 : -3;
    if (r.criteres.hauteur_cm) score += dansPlage(d.hauteur, r.criteres.hauteur_cm, 0.05) ? 3 : -3;
    const vol = (d.hauteur * d.largeur * d.profondeur) / 1e6;
    if (r.plage_variante_m3) {
      const [a, b] = r.plage_variante_m3;
      if (vol >= a && vol <= b) {
        score += 4;
        raisons.push(`volume apparent ${vol.toFixed(2)} m³ dans la plage de la variante`);
      }
    } else if (r.volume_geometrique_m3.q1 && r.volume_geometrique_m3.q3 && vol >= r.volume_geometrique_m3.q1 * 0.7 && vol <= r.volume_geometrique_m3.q3 * 1.3) {
      score += 1;
    }
  }
  // Repli « (non précisé) » : écarté dès qu'une caractéristique discriminante est visible
  const caracteristiqueVue = (["nb_portes", "nb_places", "nb_tiroirs", "largeur_couchage_cm", "diagonale_pouces"] as const).some((k) => c[k] != null);
  if ((r.variante_de ?? r.id).endsWith("-NC") && caracteristiqueVue) {
    score -= 6;
    raisons.push("repli moins pertinent : la caractéristique discriminante est visible");
  }
  // 5. Pertinence
  score += { 1: 1, 2: 0.5, 3: 0, 4: -1 }[r.niveau_pertinence];
  if (r.famille_id === "ANC" && !c.ancien) score -= 4;
  if (r.mesurabilite === "non directement mesurable") score -= 2;
  if (r.variante_de && !d) score -= 1; // sans dimensions apparentes, la sous-catégorie de base passe avant ses variantes
  return { score, raisons };
}

/**
 * Renvoie au plus `k` candidates classées. Toujours au moins le repli « (non précisé) » de la famille quand elle
 * existe, pour que le modèle ne soit jamais obligé de choisir une référence trop précise.
 */
export function rechercherCandidates(cat: Catalogue, q: Requete, k = 5): Candidate[] {
  const notees = cat.references
    .map((r) => ({ r, ...scoreReference(r, q) }))
    // Sans famille, il faut au moins une vraie correspondance de texte (sinon : référence inconnue).
    .filter((x) => Number.isFinite(x.score) && x.score >= (q.famille_id ? 1 : SEUIL_SANS_FAMILLE))
    .sort((a, b) => b.score - a.score || a.r.id.localeCompare(b.r.id));
  const res = notees.slice(0, k).map((x) => ({ id: x.r.id, nom: x.r.nom, score: Math.round(x.score * 10) / 10, raisons: x.raisons, reference: x.r }));
  const repli = q.famille_id ? cat.references.find((r) => r.famille_id === q.famille_id && r.id.endsWith("-NC") && !r.variante_de) : undefined;
  if (repli && !res.some((c) => c.id === repli.id)) res.push({ id: repli.id, nom: repli.nom, score: 0, raisons: ["repli : caractéristique non visible"], reference: repli });
  return res;
}

/**
 * Texte compact remis au modèle pour une famille (deuxième passage, ou consignes par famille) : identifiants,
 * noms, caractéristiques discriminantes. Jamais de volume ni de prix (le modèle n'en a pas besoin).
 */
export function texteCandidats(candidates: Candidate[]): string {
  return candidates.map((c) => `${c.id} : ${c.nom} — ${c.reference.caracteristiques_discriminantes}${c.reference.variante_de ? ` (variante de ${c.reference.variante_de})` : ""}`).join("\n");
}
