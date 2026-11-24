import { NextResponse, type NextRequest } from "next/server";
import { supabaseSecretKey } from "@/lib/env.server";
import { cronAuthorized } from "@/lib/auth/cron";
import { purgeAbandonedDrafts, purgeDueVideos } from "@/lib/storage/media";

/**
 * Tâche quotidienne (Vercel Cron, vercel.json), avec « Authorization: Bearer <CRON_SECRET> » :
 * 1. purge RGPD des vidéos échues ou supprimées par le client (fichiers réellement effacés) ;
 * 2. suppression des brouillons jamais envoyés depuis plus de 30 jours.
 */
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!cronAuthorized(request)) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  if (!supabaseSecretKey()) return NextResponse.json({ error: "SUPABASE_SECRET_KEY manquante" }, { status: 500 });
  try {
    const videos = await purgeDueVideos();
    const drafts = await purgeAbandonedDrafts();
    return NextResponse.json({ ...videos, abandonedDrafts: drafts });
  } catch (error) {
    console.error("[purge]", error);
    return NextResponse.json({ error: "Purge interrompue" }, { status: 500 });
  }
}
