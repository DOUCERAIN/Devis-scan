import { NextResponse, type NextRequest } from "next/server";
import { cronAuthorized } from "@/lib/auth/cron";
import { createAdminClient } from "@/lib/supabase/admin";
import { runRequestAnalysis } from "@/lib/analysis/run";

/**
 * Reprise des analyses (Vercel Cron, avec « Authorization: Bearer <CRON_SECRET> ») :
 * 1. une analyse restée « en cours » plus de 30 minutes est marquée en échec (la demande passe à vérifier) ;
 * 2. les demandes envoyées depuis plus de 10 minutes sans analyse sont analysées (3 au plus par passage).
 */
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  if (!cronAuthorized(request)) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "SUPABASE_SECRET_KEY manquante" }, { status: 500 });

  const stale = new Date(Date.now() - 30 * 60_000).toISOString();
  const { data: stuck } = await admin
    .from("analysis_runs")
    .update({ status: "failed", stage: "failed", error_code: "timeout", error_message: "Analyse interrompue.", finished_at: new Date().toISOString() })
    .in("status", ["queued", "running"])
    .lt("created_at", stale)
    .select("request_id");
  for (const run of stuck ?? []) {
    await admin.from("quote_requests").update({ status: "to_review" }).eq("id", run.request_id).eq("status", "analyzing");
  }

  const { data: waiting } = await admin
    .from("quote_requests")
    .select("id, analysis_runs(id)")
    .eq("status", "submitted")
    .lt("submitted_at", new Date(Date.now() - 10 * 60_000).toISOString())
    .order("submitted_at")
    .limit(20);
  const todo = (waiting ?? []).filter((r) => r.analysis_runs.length === 0).slice(0, 3);
  const results = [];
  for (const r of todo) results.push(await runRequestAnalysis(r.id));
  return NextResponse.json({ stuck: stuck?.length ?? 0, analysed: results.map((r) => r.status) });
}
