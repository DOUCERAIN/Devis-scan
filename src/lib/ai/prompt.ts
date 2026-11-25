import type { CatalogRef } from "./postprocess.ts";

/**
 * Consignes envoyées au modèle. Texte stable (mis en cache côté API) : ne jamais y
 * insérer de date, d'identifiant ou de donnée propre à une demande.
 */
export const ANALYSIS_INSTRUCTIONS = `Vous aidez un déménageur professionnel à établir l'inventaire d'une pièce à partir d'images extraites d'une vidéo filmée par un particulier.

Règles impératives :
- Listez uniquement les meubles, appareils et objets à déménager réellement visibles sur les images. N'inventez jamais un objet que vous ne voyez pas. Ne déduisez pas un objet de la seule fonction de la pièce.
- Objet physique, pas type d'objet : un logement contient souvent plusieurs meubles identiques (2 lits, 4 chaises, 2 tables de chevet). Ne fusionnez JAMAIS deux objets parce qu'ils se ressemblent ou ont le même type.
- Un même objet physique vu sur plusieurs images ne doit apparaître qu'une fois : regroupez ses vues (indices d'images dans image_indexes, numérotés à partir de 0 dans l'ordre fourni, en ne citant que les images où l'objet est réellement visible). Décidez d'après des indices concrets : position dans la pièce, orientation, dimensions apparentes, objets voisins, signes distinctifs, continuité d'une image à la suivante.
- Deux objets visibles en même temps sur une même image sont deux objets distincts (sauf reflet dans un miroir).
- Plusieurs objets identiques distincts : une seule entrée avec quantity = nombre d'objets, seulement si vous les distinguez réellement (par exemple 4 chaises autour d'une table) ; ou une entrée par objet si leurs positions diffèrent nettement.
- location_in_room : position de l'objet dans la pièce (mur, coin, à côté de quoi). distinctive_features : ce qui distingue cet exemplaire précis (couleur, matière, usure, objets posés dessus). Quelques mots, sans inventer.
- identity_doubt : null dans le cas général. Renseignez-le seulement si vous hésitez réellement entre UN objet vu deux fois et DEUX objets distincts : other_entry_index = indice de l'autre entrée de votre réponse (ou null), other_room = true si l'objet semble être le même qu'un objet d'une autre pièce (par exemple vu à travers une porte ouverte), reason = ce qui fait hésiter. Dans le doute, gardez les deux entrées : un déménageur tranchera.
- catalog_id : choisissez l'identifiant du catalogue ci-dessous qui correspond exactement à l'objet ; s'il n'y en a pas, écrivez "autre" et décrivez l'objet dans label.
- confidence : votre degré de certitude entre 0 et 1 sur l'identification ET la quantité. Ce n'est pas une probabilité garantie ; soyez prudent : objet partiellement visible, flou ou ambigu → valeur basse.
- visibility : "visible" (objet entier bien visible), "partial" (en partie caché ou coupé), "uncertain" (doute sur la nature même de l'objet).
- dimensions_cm : si l'objet ne figure pas au catalogue, ou si sa ligne du catalogue porte la mention [dimensions], et que vous pouvez estimer ses dimensions de façon raisonnable (largeur, profondeur, hauteur en cm) ; sinon null.
- Ne comptez pas les éléments fixes (radiateurs, éléments de cuisine encastrés, placards muraux, luminaires au plafond) sauf s'ils sont manifestement démontables et à déménager.
- Cartons déjà faits : catalog_id du carton correspondant si présent, quantité visible uniquement.
- Les images peuvent contenir des personnes, des documents ou des écrans : ignorez-les, ne les décrivez pas.
- Réponses en français.`;

/** Liste du catalogue, triée et stable, pour le prompt. */
export function catalogPrompt(catalog: CatalogRef[]): string {
  const lines = [...catalog]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((ref) => `${ref.id} : ${ref.name}${ref.synonyms.length ? ` (${ref.synonyms.join(", ")})` : ""}${ref.moving_volume_avg === null ? " [dimensions]" : ""}`);
  return `Catalogue (identifiant : nom) :\n${lines.join("\n")}`;
}

export function roomPrompt(room: { name: string; description: string | null }, imageCount: number): string {
  return `Pièce : « ${room.name} »${room.description ? `. Précision du client : « ${room.description} »` : ""}.
${imageCount} image${imageCount > 1 ? "s" : ""} de cette pièce ci-dessus (indices 0 à ${imageCount - 1}). Établissez l'inventaire de la pièce.`;
}
