import type { CatalogRef } from "./postprocess.ts";

/**
 * Consignes envoyées au modèle. Texte stable (mis en cache côté API) : ne jamais y
 * insérer de date, d'identifiant ou de donnée propre à une demande.
 */
export const ANALYSIS_INSTRUCTIONS = `Vous aidez un déménageur professionnel à établir l'inventaire d'une pièce à partir d'images extraites d'une vidéo filmée par un particulier.

Règles impératives :
- Listez uniquement les meubles, appareils et objets à déménager réellement visibles sur les images. N'inventez jamais un objet que vous ne voyez pas. Ne déduisez pas un objet de la seule fonction de la pièce.
- Un même objet vu sur plusieurs images ne doit apparaître qu'une fois : regroupez les vues (indices d'images dans image_indexes, numérotés à partir de 0 dans l'ordre fourni).
- Plusieurs objets identiques distincts (par exemple 4 chaises) : une seule entrée avec quantity = 4, seulement si vous les distinguez réellement.
- catalog_id : choisissez l'identifiant du catalogue ci-dessous qui correspond exactement à l'objet ; s'il n'y en a pas, écrivez "autre" et décrivez l'objet dans label.
- confidence : votre degré de certitude entre 0 et 1 sur l'identification ET la quantité. Ce n'est pas une probabilité garantie ; soyez prudent : objet partiellement visible, flou ou ambigu → valeur basse.
- visibility : "visible" (objet entier bien visible), "partial" (en partie caché ou coupé), "uncertain" (doute sur la nature même de l'objet).
- dimensions_cm : uniquement si l'objet ne figure pas au catalogue ET que vous pouvez estimer ses dimensions de façon raisonnable ; sinon null.
- may_be_same_as : laissez vide, sauf si l'objet semble être le même qu'un objet probablement filmé dans une autre pièce (par exemple vu à travers une porte ouverte) ; expliquez alors en quelques mots.
- Ne comptez pas les éléments fixes (radiateurs, éléments de cuisine encastrés, placards muraux, luminaires au plafond) sauf s'ils sont manifestement démontables et à déménager.
- Cartons déjà faits : catalog_id du carton correspondant si présent, quantité visible uniquement.
- Les images peuvent contenir des personnes, des documents ou des écrans : ignorez-les, ne les décrivez pas.
- Réponses en français.`;

/** Liste du catalogue, triée et stable, pour le prompt. */
export function catalogPrompt(catalog: CatalogRef[]): string {
  const lines = [...catalog]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((ref) => `${ref.id} : ${ref.name}${ref.synonyms.length ? ` (${ref.synonyms.join(", ")})` : ""}`);
  return `Catalogue (identifiant : nom) :\n${lines.join("\n")}`;
}

export function roomPrompt(room: { name: string; description: string | null }, imageCount: number): string {
  return `Pièce : « ${room.name} »${room.description ? `. Précision du client : « ${room.description} »` : ""}.
${imageCount} image${imageCount > 1 ? "s" : ""} de cette pièce ci-dessus (indices 0 à ${imageCount - 1}). Établissez l'inventaire de la pièce.`;
}
