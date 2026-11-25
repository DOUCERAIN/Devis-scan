/**
 * Décide si un devis FORMEL peut être envoyé automatiquement après l'analyse, ou s'il faut
 * une estimation indicative et une validation humaine. Règle volontairement stricte :
 * le moindre doute renvoie vers le déménageur, avec la liste des motifs.
 */
export type EligibilityInput = {
  /** L'entreprise a activé l'envoi automatique de devis formels. */
  autoFormalEnabled: boolean;
  /** Raison sociale, SIRET et adresse renseignés. */
  legalIdentity: boolean;
  /** Grille tarifaire enregistrée par l'entreprise. */
  pricingConfigured: boolean;
  /** Analyse produite par le simulateur de test. */
  simulated: boolean;
  /** Pièces dont l'analyse a échoué. */
  failedRooms: number;
  /** Pièces déclarées par le client sans vidéo analysée. */
  roomsWithoutImages: number;
  /** Objets ni sûrs ni vérifiés (à vérifier, incertains, doublons). */
  itemsToReview: number;
  /** Volume potentiel (objets non comptés). */
  potentialM3: number;
  /** Objets sans volume de référence. */
  unknownVolumeItems: number;
  /** Hypothèses du calcul de prix (étage inconnu, distance estimée…). */
  pricingAssumptions: string[];
};

export type Eligibility = { formal: boolean; reasons: string[] };

export function formalQuoteEligibility(i: EligibilityInput): Eligibility {
  const reasons: string[] = [];
  if (i.simulated) reasons.push("Analyse produite par le simulateur de test (jamais de devis formel).");
  if (!i.pricingConfigured) reasons.push("Grille tarifaire non enregistrée.");
  if (!i.legalIdentity) reasons.push("Identité légale de l'entreprise incomplète (raison sociale, SIRET, adresse).");
  if (i.failedRooms > 0) reasons.push(`${i.failedRooms} pièce${i.failedRooms > 1 ? "s" : ""} non analysée${i.failedRooms > 1 ? "s" : ""}.`);
  if (i.roomsWithoutImages > 0) reasons.push(`${i.roomsWithoutImages} pièce${i.roomsWithoutImages > 1 ? "s" : ""} sans vidéo.`);
  if (i.itemsToReview > 0) reasons.push(`${i.itemsToReview} objet${i.itemsToReview > 1 ? "s" : ""} à vérifier (confiance insuffisante ou doublon possible).`);
  if (i.potentialM3 > 0) reasons.push("Objets incertains non comptés dans le volume.");
  if (i.unknownVolumeItems > 0) reasons.push(`${i.unknownVolumeItems} objet${i.unknownVolumeItems > 1 ? "s" : ""} sans volume de référence.`);
  for (const a of i.pricingAssumptions) reasons.push(a);
  // L'option désactivée n'est pas un défaut de fiabilité : elle est signalée en dernier.
  if (!i.autoFormalEnabled) reasons.push("Envoi automatique des devis formels non activé par l'entreprise.");
  return { formal: reasons.length === 0, reasons };
}
