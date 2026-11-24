/**
 * Messages compréhensibles pour les erreurs levées par les fonctions SQL du
 * parcours client (voir les migrations *_public_request_flow et *_customer_flow).
 */
const MESSAGES: Array<[RegExp, string]> = [
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
