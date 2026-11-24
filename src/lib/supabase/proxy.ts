import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isSupabaseConfigured, publicEnv } from "@/lib/env";
import type { Database } from "./database.types";

const PRIVATE_PREFIX = "/espace";
const GUEST_ONLY = ["/connexion", "/inscription"];

/**
 * Rafraîchit la session Supabase à chaque requête et fait les redirections
 * « optimistes » (la vraie vérification d'accès est refaite sur le serveur
 * dans chaque page et chaque action, puis par les règles RLS).
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  if (!isSupabaseConfigured()) return response;

  const env = publicEnv();
  const supabase = createServerClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
        for (const [key, value] of Object.entries(headers)) response.headers.set(key, value);
      },
    },
  });

  // Ne rien placer entre la création du client et getClaims() : c'est cet appel
  // qui valide le jeton et le renouvelle si nécessaire.
  const { data } = await supabase.auth.getClaims();
  const isLoggedIn = Boolean(data?.claims?.sub);
  const { pathname, search } = request.nextUrl;

  if (!isLoggedIn && pathname.startsWith(PRIVATE_PREFIX)) {
    const url = request.nextUrl.clone();
    url.pathname = "/connexion";
    url.search = "";
    url.searchParams.set("suivant", pathname + search);
    return redirectKeepingCookies(url, response);
  }

  if (isLoggedIn && GUEST_ONLY.includes(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = PRIVATE_PREFIX;
    url.search = "";
    return redirectKeepingCookies(url, response);
  }

  return response;
}

function redirectKeepingCookies(url: URL, from: NextResponse) {
  const redirect = NextResponse.redirect(url);
  for (const cookie of from.cookies.getAll()) redirect.cookies.set(cookie);
  return redirect;
}
