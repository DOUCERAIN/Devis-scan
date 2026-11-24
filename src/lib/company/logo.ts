import { publicEnv } from "../env.ts";

/** URL publique d'un logo stocké dans le bucket company-assets. */
export function companyLogoUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  const base = publicEnv().NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/, "");
  return `${base}/storage/v1/object/public/company-assets/${path.split("/").map(encodeURIComponent).join("/")}`;
}
