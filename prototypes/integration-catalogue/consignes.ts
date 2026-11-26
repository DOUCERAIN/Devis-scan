import { createHash } from "node:crypto";
import type { Catalogue } from "./catalogue.ts";

/**
 * Consignes communes à tous les fournisseurs — PROTOTYPE (le moteur actuel garde src/lib/ai/prompt.ts).
 * Le texte est stable (mis en cache par les fournisseurs qui le permettent) et versionné par son empreinte :
 * chaque analyse enregistre la version des consignes utilisées.
 */
export const CONSIGNES_V2 = `Vous aidez un déménageur à établir l'inventaire d'une pièce à partir d'images extraites d'une vidéo.
Répondez UNIQUEMENT par un objet JSON conforme au contrat Devis Scan 2.0 (version_contrat, objets, remarques_piece).
Pour chaque objet réellement visible :
1. reconnaissez l'objet (libelle en français) et sa famille (famille_id, liste ci-dessous) ;
2. décrivez ce que vous voyez dans caracteristiques (nombre de portes, de places, de tiroirs, largeur de couchage, diagonale…) ; null si ce n'est pas visible, jamais deviné ;
3. choisissez reference_id parmi les identifiants du catalogue ci-dessous, sans en inventer ; si la caractéristique qui sépare deux références n'est pas visible, choisissez la référence « (non précisé) » de la famille ou mettez statut_reference = "a_confirmer" avec les alternatives ;
4. si aucune référence ne convient, statut_reference = "inconnue" et reference_id = null ;
5. justifiez votre choix dans indices (quelques mots chacun) et donnez une confiance prudente entre 0 et 1.
N'indiquez jamais de volume ni de prix. dimensions_apparentes_cm est facultatif et purement indicatif.
Un objet vu sur plusieurs images n'apparaît qu'une fois ; plusieurs objets identiques distincts sont plusieurs exemplaires.`;

/** Catalogue remis au modèle : familles puis références (identifiant, nom, caractéristique discriminante). */
export function texteCatalogue(cat: Catalogue, options: { inclureVariantes?: boolean; niveauMax?: 1 | 2 | 3 | 4 } = {}): string {
  const niveauMax = options.niveauMax ?? 3;
  const lignes: string[] = [];
  for (const f of cat.familles) {
    const refs = cat.references.filter((r) => r.famille_id === f.identifiant && r.niveau_pertinence <= niveauMax && (options.inclureVariantes || !r.variante_de));
    if (!refs.length) continue;
    lignes.push(`[${f.identifiant}] ${f.nom}`);
    for (const r of refs) lignes.push(`  ${r.id} : ${r.nom} — ${r.caracteristiques_discriminantes}`);
  }
  return lignes.join("\n");
}

export function versionConsignes(texte: string): string {
  return "v2-" + createHash("sha256").update(texte).digest("hex").slice(0, 12);
}

/** Estimation grossière (4 caractères ≈ 1 jeton) pour comparer les options ; pas un décompte exact. */
export const estimerJetons = (texte: string) => Math.ceil(texte.length / 4);
