import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { cronSecret } from "@/lib/env.server";
import { MEDIA_BUCKET } from "@/lib/storage/media";

/**
 * Purge RGPD des vidéos arrivées à échéance (durée de conservation de chaque entreprise).
 * Supprime RÉELLEMENT les fichiers du stockage (vidéos et images extraites),
 * puis marque les vidéos comme supprimées en base.
 *
 * Appelée chaque jour par Vercel Cron (vercel.json), avec l'en-tête
 * « Authorization: Bearer <CRON_SECRET> ».
 */
export const dynamic = "force-dynamic";

function authorized(request: NextRequest): boolean {
  const secret = cronSecret();
  if (!secret) return false;
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "SUPABASE_SECRET_KEY manquante" }, { status: 500 });
  }

  let purged = 0;
  const failures: string[] = [];
  for (let round = 0; round < 10; round++) {
    const { data: due, error } = await admin.rpc("claim_videos_for_purge", { max_items: 100 });
    if (error) return NextResponse.json({ error: "Lecture des vidéos à purger impossible" }, { status: 500 });
    if (!due || due.length === 0) break;

    const paths = due.flatMap((v) => [v.storage_path, ...(v.frame_paths ?? [])]);
    const { error: removeError } = await admin.storage.from(MEDIA_BUCKET).remove(paths);
    if (removeError) {
      console.error("[purge] storage.remove", removeError.message);
      failures.push(...due.map((v) => v.video_id));
      break;
    }
    const { data: count, error: markError } = await admin.rpc("mark_videos_purged", { video_ids: due.map((v) => v.video_id) });
    if (markError) return NextResponse.json({ error: "Mise à jour impossible après suppression" }, { status: 500 });
    purged += count ?? 0;
    if (due.length < 100) break;
  }

  return NextResponse.json({ purged, failed: failures.length });
}
