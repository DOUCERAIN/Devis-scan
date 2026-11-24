/**
 * Identité du produit.
 *
 * C'est le SEUL endroit où le nom, la signature et le logo du produit sont définis.
 * Pour renommer le produit, modifiez ce fichier : pages, e-mails et PDF suivront.
 * Les couleurs se règlent dans src/app/globals.css (variables --ds-*).
 */
export const brand = {
  /** Nom affiché partout. « Devis Scan » est un nom de travail. */
  name: "Devis Scan",
  /** Phrase courte utilisée sous le nom et dans les métadonnées. */
  tagline:
    "L'inventaire de déménagement par vidéo, clair pour le client et fiable pour le professionnel.",
  /** Description pour les moteurs de recherche et les aperçus de liens. */
  description:
    "Vos clients filment leur logement, l'IA prépare l'inventaire et le volume, vous vérifiez et envoyez votre devis.",
  /** Signature discrète affichée sur les pages aux couleurs d'un déménageur. */
  poweredBy: "Propulsé par Devis Scan",
} as const;

export type Brand = typeof brand;
