import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { safeInternalPath } from "@/lib/form-data";

const OTP_TYPES: EmailOtpType[] = ["signup", "invite", "magiclink", "recovery", "email_change", "email"];

/**
 * Point d'arrivée des liens envoyés par e-mail (confirmation d'inscription,
 * réinitialisation du mot de passe). Accepte les deux formats Supabase :
 * `?code=` (flux PKCE, modèles d'e-mail par défaut) et `?token_hash=&type=`.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const next = safeInternalPath(searchParams.get("suivant") ?? searchParams.get("next"));
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  const supabase = await createClient();
  let errorCode: string | undefined;

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    errorCode = error ? error.code ?? "unknown" : undefined;
  } else if (tokenHash && type && OTP_TYPES.includes(type)) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    errorCode = error ? error.code ?? "unknown" : undefined;
  } else {
    errorCode = searchParams.get("error_code") ?? "missing_token";
  }

  if (errorCode) {
    return NextResponse.redirect(new URL(`/auth/erreur?code=${encodeURIComponent(errorCode)}`, origin));
  }
  return NextResponse.redirect(new URL(next, origin));
}
