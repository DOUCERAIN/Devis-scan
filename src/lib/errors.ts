import type { AuthError, PostgrestError } from "@supabase/supabase-js";
import type { z } from "zod";

/**
 * Gestion centralisée des erreurs.
 * - Les messages montrés à l'utilisateur sont en français, sans jargon.
 * - Le détail technique est journalisé côté serveur, jamais renvoyé au navigateur.
 */

export type FieldErrors = Record<string, string>;

export type ActionState =
  | { status: "idle" }
  | { status: "success"; message: string }
  | { status: "error"; message: string; fieldErrors?: FieldErrors; values?: FormValues };

/** Valeurs saisies renvoyées au formulaire pour ne pas les perdre après une erreur (jamais de mot de passe). */
export type FormValues = Record<string, string | undefined>;

export const idleState: ActionState = { status: "idle" };

export const GENERIC_ERROR = "Une erreur inattendue est survenue. Réessayez dans un instant.";

export function success(message: string): ActionState {
  return { status: "success", message };
}

export function failure(message: string, fieldErrors?: FieldErrors, values?: FormValues): ActionState {
  return { status: "error", message, fieldErrors, values: values && withoutSecrets(values) };
}

function withoutSecrets(values: FormValues): FormValues {
  const copy: FormValues = {};
  for (const [key, value] of Object.entries(values)) {
    if (!/password/i.test(key)) copy[key] = value;
  }
  return copy;
}

/** Transforme les erreurs de validation en messages par champ. */
export function validationFailure(error: z.ZodError, values?: FormValues): ActionState {
  const fieldErrors: FieldErrors = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".");
    if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
  }
  return failure("Certains champs sont à corriger.", fieldErrors, values);
}

const AUTH_MESSAGES: Record<string, string> = {
  invalid_credentials: "E-mail ou mot de passe incorrect.",
  email_not_confirmed: "Votre adresse e-mail n'est pas encore confirmée. Cliquez sur le lien reçu par e-mail.",
  user_already_exists: "Un compte existe déjà avec cette adresse e-mail.",
  email_exists: "Un compte existe déjà avec cette adresse e-mail.",
  weak_password: "Ce mot de passe est trop faible. Choisissez au moins 8 caractères, avec lettres et chiffres.",
  same_password: "Le nouveau mot de passe doit être différent de l'ancien.",
  over_email_send_rate_limit: "Trop d'e-mails envoyés. Patientez quelques minutes avant de réessayer.",
  over_request_rate_limit: "Trop de tentatives. Patientez quelques minutes avant de réessayer.",
  otp_expired: "Ce lien a expiré ou a déjà été utilisé. Demandez-en un nouveau.",
  flow_state_expired: "Ce lien a expiré. Demandez-en un nouveau.",
  bad_code_verifier: "Ce lien doit être ouvert dans le navigateur qui a fait la demande.",
  session_not_found: "Votre session a expiré. Reconnectez-vous.",
  signup_disabled: "Les inscriptions sont momentanément fermées.",
  email_address_invalid: "Cette adresse e-mail n'est pas acceptée.",
};

export function authErrorMessage(error: AuthError | null | undefined, context: string): string {
  if (!error) return GENERIC_ERROR;
  const known = error.code ? AUTH_MESSAGES[error.code] : undefined;
  if (known) return known;
  console.error(`[auth] ${context}`, { code: error.code, status: error.status, message: error.message });
  return GENERIC_ERROR;
}

const DB_MESSAGES: Record<string, string> = {
  "42501": "Vous n'avez pas les droits nécessaires pour cette action.",
  "23505": "Cet élément existe déjà.",
  "23514": "Une valeur ne respecte pas les règles attendues.",
  "23503": "Cet élément est lié à des données introuvables.",
  "22023": "Une valeur saisie n'est pas valide.",
  PGRST116: "Élément introuvable.",
};

export function dbErrorMessage(error: PostgrestError | null | undefined, context: string): string {
  if (!error) return GENERIC_ERROR;
  console.error(`[db] ${context}`, { code: error.code, message: error.message, details: error.details });
  return DB_MESSAGES[error.code] ?? GENERIC_ERROR;
}
