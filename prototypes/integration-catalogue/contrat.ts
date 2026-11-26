import { z } from "zod";

/**
 * Contrat commun des réponses IA — version 2.0 (PROTOTYPE, non branché sur l'application).
 *
 * Tous les fournisseurs (Anthropic Haiku ou Sonnet, modèle open source, autre) produisent EXACTEMENT ce format.
 * Le modèle n'y met jamais de volume ni de prix : il reconnaît, décrit, et désigne une référence du catalogue
 * Devis Scan parmi des identifiants existants. Le serveur vérifie tout, puis lit dimensions et volumes dans le
 * catalogue (resolution.ts). Les champs inconnus sont refusés (aucun « volume » glissé dans la réponse).
 *
 * Miroir JSON Schema : docs/preparation-integration-catalogue/contrat_commun_ia.json (testé : mêmes champs).
 */
export const VERSION_CONTRAT = "2.0";

export const STATUTS_REFERENCE = ["trouvee", "a_confirmer", "inconnue"] as const;

const cadre = z
  .object({
    image: z.number().int().min(0).max(63),
    /** Coordonnées normalisées (0 à 1) du rectangle englobant sur l'image : gauche, haut, largeur, hauteur. */
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1),
    largeur: z.number().min(0).max(1),
    hauteur: z.number().min(0).max(1),
  })
  .strict();

const exemplaire = z
  .object({
    id_exemplaire: z.string().trim().min(1).max(40),
    images: z.array(z.number().int().min(0).max(63)).max(64),
    cadres: z.array(cadre).max(64),
    position_piece: z.string().trim().max(200),
    signes_distinctifs: z.string().trim().max(200),
  })
  .strict();

/** Caractéristiques physiques observées : toutes facultatives, jamais inventées (null si non visible). */
const caracteristiques = z
  .object({
    nb_portes: z.number().int().min(0).max(20).nullable(),
    nb_places: z.number().int().min(0).max(20).nullable(),
    nb_tiroirs: z.number().int().min(0).max(40).nullable(),
    largeur_couchage_cm: z.number().min(40).max(250).nullable(),
    diagonale_pouces: z.number().min(10).max(150).nullable(),
    forme: z.string().trim().max(80).nullable(),
    materiau: z.string().trim().max(80).nullable(),
    portes_coulissantes: z.boolean().nullable(),
    extensible: z.boolean().nullable(),
    demontable_apparent: z.boolean().nullable(),
    fragile: z.boolean().nullable(),
    ancien: z.boolean().nullable(),
  })
  .strict();

const dimensionsApparentes = z
  .object({ hauteur: z.number().positive().max(2000), largeur: z.number().positive().max(2000), profondeur: z.number().positive().max(2000) })
  .strict();

export const objetSchema = z
  .object({
    id_objet: z.string().trim().min(1).max(40),
    libelle: z.string().trim().min(1).max(120),
    famille_id: z.string().trim().min(2).max(10),
    sous_categorie_id: z.string().trim().max(40).nullable(),
    reference_id: z.string().trim().max(40).nullable(),
    statut_reference: z.enum(STATUTS_REFERENCE),
    alternatives: z.array(z.object({ reference_id: z.string().trim().min(1).max(40), raison: z.string().trim().max(200) }).strict()).max(3),
    quantite: z.number().int().min(1).max(200),
    exemplaires: z.array(exemplaire).max(200),
    caracteristiques,
    /** Indicatives seulement : jamais utilisées comme volume faisant autorité. */
    dimensions_apparentes_cm: dimensionsApparentes.nullable(),
    indices: z.array(z.string().trim().min(1).max(160)).max(10),
    confiance: z.number().min(0).max(1),
    motif_incertitude: z.string().trim().max(300).nullable(),
    doute_identite: z
      .object({ autre_objet_id: z.string().trim().max(40).nullable(), autre_piece: z.boolean(), raison: z.string().trim().min(1).max(300) })
      .strict()
      .nullable(),
  })
  .strict();

/** Réponse du modèle pour UNE pièce. */
export const reponsePieceSchema = z
  .object({
    version_contrat: z.literal(VERSION_CONTRAT),
    objets: z.array(objetSchema).max(150),
    remarques_piece: z.string().trim().max(1000),
  })
  .strict();

/** Enveloppe ajoutée par le SERVEUR (jamais par le modèle) : traçabilité et rejouabilité. */
export const enveloppeSchema = z
  .object({
    id_analyse: z.string().min(1),
    id_piece: z.string().min(1),
    fournisseur: z.string().min(1),
    modele: z.string().min(1),
    version_consignes: z.string().min(1),
    version_catalogue: z.string().min(1),
    empreinte_catalogue: z.string().min(8),
    horodatage: z.string().min(10),
    reponse_brute: z.string(),
    reponse: reponsePieceSchema.nullable(),
    erreur: z.string().nullable(),
  })
  .strict();

export type ObjetIA = z.infer<typeof objetSchema>;
export type ReponsePiece = z.infer<typeof reponsePieceSchema>;
export type Enveloppe = z.infer<typeof enveloppeSchema>;

/** Lit le texte d'un fournisseur. Ne lève pas d'exception : renvoie l'erreur en clair (conservée dans l'enveloppe). */
export function lireReponse(texte: string): { ok: true; reponse: ReponsePiece } | { ok: false; erreur: string } {
  let brut: unknown;
  try {
    brut = JSON.parse(texte);
  } catch {
    return { ok: false, erreur: "réponse non JSON" };
  }
  const r = reponsePieceSchema.safeParse(brut);
  if (!r.success) return { ok: false, erreur: r.error.issues.map((i) => `${i.path.join(".")} : ${i.message}`).join(" ; ").slice(0, 1000) };
  return { ok: true, reponse: r.data };
}
