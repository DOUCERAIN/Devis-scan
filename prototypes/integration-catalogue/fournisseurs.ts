import { createHash } from "node:crypto";
import type { Catalogue } from "./catalogue.ts";
import type { Enveloppe } from "./contrat.ts";
import { lireReponse } from "./contrat.ts";
import type { ElementResolu } from "./resolution.ts";
import { resoudrePiece } from "./resolution.ts";

/**
 * Couche fournisseurs — PROTOTYPE (aucun appel réseau ici).
 *
 * Un fournisseur ne fait qu'une chose : recevoir des images et des consignes, renvoyer un TEXTE. L'adaptateur
 * propre au fournisseur (Anthropic, modèle open source local, autre API) se charge du format d'appel ; il ne
 * touche ni au catalogue, ni aux volumes, ni aux prix. Tout ce qui suit (validation du contrat, résolution,
 * volumes) est commun.
 */
export type EntreePiece = {
  id_analyse: string;
  id_piece: string;
  nom_piece: string;
  images: { type: "image/jpeg" | "image/png" | "image/webp"; base64: string }[];
  consignes: string;
  version_consignes: string;
};
export interface FournisseurReconnaissance {
  readonly id: string; // « anthropic », « open-source-local », « simulation-a »…
  readonly modele: string;
  readonly simule: boolean;
  analyserPiece(entree: EntreePiece): Promise<string>;
}

/** Nettoyage minimal commun : certains modèles entourent le JSON de balises ```json … ```. */
export function extraireJson(texte: string): string {
  const m = texte.match(/```(?:json)?\s*([\s\S]*?)```/);
  return (m ? m[1] : texte).trim();
}

export const empreinte = (texte: string) => createHash("sha256").update(texte).digest("hex");

/**
 * Analyse une pièce avec le premier fournisseur qui renvoie une réponse conforme ; les suivants servent de
 * secours. Chaque tentative est conservée (réponse brute, erreur) pour être rejouée ou comparée.
 */
export async function analyserAvecSecours(fournisseurs: FournisseurReconnaissance[], entree: EntreePiece, cat: Catalogue, horloge = () => new Date().toISOString()): Promise<{ tentatives: Enveloppe[]; retenue: Enveloppe | null; elements: ElementResolu[] }> {
  const tentatives: Enveloppe[] = [];
  for (const f of fournisseurs) {
    let brute = "";
    let erreur: string | null = null;
    let reponse = null;
    try {
      brute = await f.analyserPiece(entree);
      const lu = lireReponse(extraireJson(brute));
      if (lu.ok) reponse = lu.reponse;
      else erreur = lu.erreur;
    } catch (e) {
      erreur = `erreur du fournisseur : ${(e as Error).message}`.slice(0, 500);
    }
    const env: Enveloppe = {
      id_analyse: entree.id_analyse, id_piece: entree.id_piece, fournisseur: f.id, modele: f.modele,
      version_consignes: entree.version_consignes, version_catalogue: cat.version_catalogue,
      empreinte_catalogue: cat.empreinte_catalogue_sha256, horodatage: horloge(), reponse_brute: brute, reponse, erreur,
    };
    tentatives.push(env);
    if (reponse) return { tentatives, retenue: env, elements: resoudrePiece(cat, reponse) };
  }
  return { tentatives, retenue: null, elements: [] };
}

/** Rejoue une enveloppe conservée : même réponse, catalogue éventuellement plus récent (statut « remplacée »…). */
export function rejouer(env: Enveloppe, cat: Catalogue): ElementResolu[] {
  if (!env.reponse) return [];
  return resoudrePiece(cat, env.reponse);
}

/** Compare deux résolutions (deux fournisseurs, ou deux versions) objet par objet. */
export function comparer(a: ElementResolu[], b: ElementResolu[]) {
  const cle = (e: ElementResolu) => e.id_objet;
  const mb = new Map(b.map((e) => [cle(e), e]));
  const differences: { id_objet: string; champ: string; a: unknown; b: unknown }[] = [];
  for (const ea of a) {
    const eb = mb.get(cle(ea));
    if (!eb) {
      differences.push({ id_objet: ea.id_objet, champ: "présence", a: true, b: false });
      continue;
    }
    for (const champ of ["reference_id", "quantite", "statut", "confirmation_requise"] as const) {
      if (ea[champ] !== eb[champ]) differences.push({ id_objet: ea.id_objet, champ, a: ea[champ], b: eb[champ] });
    }
  }
  for (const eb of b) if (!a.some((ea) => cle(ea) === cle(eb))) differences.push({ id_objet: eb.id_objet, champ: "présence", a: false, b: true });
  return { identiques: differences.length === 0, differences };
}

/** Fournisseur simulé pour les tests : renvoie un texte fixé à l'avance (jamais présenté comme une vraie analyse). */
export class FournisseurSimule implements FournisseurReconnaissance {
  readonly simule = true;
  readonly id: string;
  readonly modele: string;
  private readonly repondre: (e: EntreePiece) => string;
  constructor(id: string, modele: string, repondre: (e: EntreePiece) => string) {
    this.id = id;
    this.modele = modele;
    this.repondre = repondre;
  }
  async analyserPiece(entree: EntreePiece): Promise<string> {
    return this.repondre(entree);
  }
}
