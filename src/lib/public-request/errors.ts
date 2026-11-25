/**
 * Messages compréhensibles pour les erreurs levées par les fonctions SQL du
 * parcours client (voir les migrations *_public_request_flow et *_customer_flow).
 */
const MESSAGES: Array<[RegExp, string]> = [
  [/Invalid size class|Dimensions or size are required/i, "Indiquez une taille approximative ou les dimensions de l'objet."],
  [/Invalid dimensions/i, "Indiquez les trois dimensions (entre 1 et 2 000 cm), ou aucune."],
  [/Invalid quantity/i, "La quantité doit être comprise entre 1 et 999."],
  [/A description is required/i, "Décrivez l'objet."],
  [/Unknown catalog item|Unknown item/i, "Cet objet n'est plus disponible. Rechargez la page."],
  [/Unknown category/i, "Catégorie inconnue."],
  [/Too many items/i, "Votre inventaire a atteint le nombre maximal d'objets (400)."],
  [/Inventory cannot be changed/i, "Votre inventaire ne peut plus être modifié."],
  [/Inventory is empty/i, "Ajoutez au moins un objet à votre inventaire."],
  [/Contact details are required/i, "Complétez vos coordonnées avant d'envoyer votre demande."],
  [/Moving date|Floors are required/i, "Complétez la date et les étages de vos logements avant d'envoyer votre demande."],
  [/Manual inventory selected|Manual inventory not selected/i, "La méthode d'inventaire a changé. Rechargez la page."],
  [/warning must be acknowledged/i, "Confirmez avoir pris connaissance de l'avertissement."],
  [/Privacy notice/i, "Votre accord est nécessaire pour établir votre devis."],
  [/First and last names/i, "Indiquez votre prénom et votre nom."],
  [/valid phone/i, "Indiquez un numéro de téléphone valide."],
  [/Company name is required/i, "Indiquez le nom de l'entreprise."],
  [/Invalid SIRET/i, "Le SIRET comporte 14 chiffres."],
  [/Too many dates/i, "30 dates alternatives au maximum."],
  [/Invalid or expired link|Invalid link/i, "Votre session a expiré. Recommencez votre demande depuis le lien de votre déménageur."],
  [/already submitted/i, "Votre demande a déjà été envoyée : elle ne peut plus être modifiée."],
  [/Unknown company/i, "Ce lien de demande de devis n'est plus valide."],
  [/Customer name is required/i, "Indiquez votre nom."],
  [/valid email/i, "Indiquez une adresse e-mail valide."],
  [/Origin city/i, "Indiquez l'adresse de départ."],
  [/Too many requests/i, "Trop de demandes en peu de temps. Réessayez dans quelques minutes."],
  [/Room name is required/i, "Donnez un nom à la pièce."],
  [/Description too long/i, "La description est trop longue (1 000 caractères maximum)."],
  [/Too many rooms/i, "Vous avez atteint le nombre maximal de pièces (30)."],
  [/Unknown room/i, "Cette pièce n'existe plus. Rechargez la page."],
  [/Room has videos/i, "Supprimez d'abord la vidéo de cette pièce."],
  [/Unsupported video format/i, "Ce format de vidéo n'est pas accepté (MP4, WebM ou MOV uniquement)."],
  [/Video too large|Invalid size/i, "Cette vidéo est trop lourde (50 Mo maximum). Filmez une séquence plus courte."],
  [/Too many videos/i, "Trois vidéos maximum par pièce."],
  [/Unknown or already uploaded video|Unknown video/i, "Cette vidéo n'est plus disponible. Recommencez l'envoi."],
  [/At least one video/i, "Ajoutez au moins une vidéo avant d'envoyer votre demande."],
  [/Too many frames/i, "Trop d'images pour cette vidéo."],
];

export const PUBLIC_GENERIC_ERROR = "Un problème est survenu. Réessayez dans un instant.";

export function publicErrorMessage(error: unknown, context: string): string {
  const message = error && typeof error === "object" && "message" in error ? String((error as { message: unknown }).message) : "";
  for (const [pattern, text] of MESSAGES) if (pattern.test(message)) return text;
  console.error(`[parcours client] ${context}`, error);
  return PUBLIC_GENERIC_ERROR;
}

export function isExpiredSession(error: unknown): boolean {
  const message = error && typeof error === "object" && "message" in error ? String((error as { message: unknown }).message) : "";
  return /Invalid or expired link|Invalid link/i.test(message);
}
