import "server-only";
import { headers } from "next/headers";
import { publicEnv } from "@/lib/env";

/** Adresse publique du site, pour les liens envoyés par e-mail. */
export async function siteUrl(): Promise<string> {
  const configured = publicEnv().NEXT_PUBLIC_SITE_URL;
  if (configured) return configured.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  return `${proto}://${host}`;
}
