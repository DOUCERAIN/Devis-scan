import "server-only";
import { timingSafeEqual } from "node:crypto";
import { cronSecret } from "@/lib/env.server";

/** Vérifie « Authorization: Bearer <CRON_SECRET> » (comparaison à temps constant). */
export function cronAuthorized(request: Request): boolean {
  const secret = cronSecret();
  if (!secret) return false;
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}
