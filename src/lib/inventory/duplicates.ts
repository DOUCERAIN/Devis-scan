/**
 * Doublons possibles côté client : texte de l'avertissement et explications en français simple.
 */

/** Avertissement que le client doit confirmer avant de valider son inventaire (texte exact, enregistré en base). */
export const CUSTOMER_INVENTORY_WARNING =
  "Merci de vérifier attentivement votre inventaire et de répondre avec honnêteté. Certains meubles peuvent apparaître plusieurs fois dans vos vidéos. Votre inventaire sera ensuite vérifié par un professionnel du déménagement. Toute différence constatée lors de cette vérification pourra entraîner une modification du volume estimé et du montant de votre devis.";

export type DuplicateForCustomer = {
  name: string;
  room: string;
  duplicateOf: { name: string; room: string } | null;
  /** Raison technique enregistrée par l'analyse (duplicate_reason), éventuellement absente. */
  reason: string | null;
};

/** Pourquoi cet élément est signalé, en une ou deux phrases compréhensibles par un particulier. */
export function customerDuplicateExplanation(d: DuplicateForCustomer): string {
  const reason = d.reason ?? "";
  const other = d.duplicateOf;
  const where = (room: string) => `dans « ${room} »`;
  const aiDoubt = /^Doute signalé par l'IA : ([\s\S]+)$/.exec(reason)?.[1]?.trim();
  const otherRoomDoubt = /^L'IA pense avoir peut-être vu ce meuble dans une autre pièce : ([\s\S]+?)( \(aucun meuble du même type repéré ailleurs\)\.)?$/.exec(reason)?.[1]?.trim();

  if (otherRoomDoubt !== undefined) {
    const target = other ? ` (« ${other.name} » ${where(other.room)})` : "";
    return `Ce meuble a peut-être déjà été filmé dans une autre pièce${target}, par exemple à travers une porte ouverte. Indication de l'analyse : ${otherRoomDoubt}`;
  }
  if (aiDoubt !== undefined) {
    const target = other ? ` que « ${other.name} » ${where(other.room)}` : " qu'un autre meuble de votre inventaire";
    return `L'analyse hésite : il pourrait s'agir du même meuble${target}, vu sous un autre angle. Indication de l'analyse : ${aiDoubt}`;
  }
  if (other) {
    return `« ${d.name} » apparaît à un autre moment de votre vidéo que « ${other.name} » ${where(other.room)}, sans que les deux soient visibles ensemble. Il peut s'agir du même meuble filmé deux fois, ou de deux meubles identiques.`;
  }
  return "Ce meuble ressemble peut-être à un autre élément de votre inventaire. Il peut s'agir du même meuble filmé deux fois, ou de deux meubles différents.";
}

/** Libellés des deux réponses possibles (identiques pour le client et pour l'historique). */
export const DUPLICATE_DECISION_LABELS = {
  distinct: "C'est un autre meuble : garder les deux",
  same: "C'est le même meuble : ne le compter qu'une fois",
} as const;
