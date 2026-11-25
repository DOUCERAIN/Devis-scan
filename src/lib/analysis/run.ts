import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { MEDIA_BUCKET } from "@/lib/storage/media";
import { aiProvider } from "@/lib/ai/config";
import { catalogPrompt } from "@/lib/ai/prompt";
import { buildItems, type CatalogRef, type RoomDetections } from "@/lib/ai/postprocess";
import { addUsage, emptyUsage, estimateCostUsd } from "@/lib/ai/cost";
import type { RoomImage } from "@/lib/ai/provider";
import { generateQuote } from "@/lib/quotes/generate";
import type { Json } from "@/lib/supabase/database.types";

/** Nombre maximal d'images envoyées par pièce (maîtrise du coût). */
export const MAX_IMAGES_PER_ROOM = 8;

export type AnalysisOutcome =
  | { status: "done"; runId: string; quote: string }
  | { status: "skipped"; reason: string }
  | { status: "failed"; runId?: string; reason: string };

/** Répartit uniformément au plus `max` éléments (images de plusieurs vidéos d'une pièce). */
export function spread<T>(items: T[], max: number): T[] {
  if (items.length <= max) return items;
  return Array.from({ length: max }, (_, i) => items[Math.floor((i * items.length) / max)]);
}

/**
 * Analyse complète d'une demande envoyée (appelée après l'envoi, et par la tâche de reprise).
 * Idempotente : une seule analyse active par demande (index unique), une demande déjà analysée est ignorée.
 */
export async function runRequestAnalysis(requestId: string): Promise<AnalysisOutcome> {
  const admin = createAdminClient();
  if (!admin) return { status: "skipped", reason: "SUPABASE_SECRET_KEY absente" };

  const { data: request } = await admin.from("quote_requests").select("id, company_id, status").eq("id", requestId).single();
  if (!request) return { status: "skipped", reason: "demande introuvable" };
  if (request.status !== "submitted") return { status: "skipped", reason: `statut ${request.status}` };

  const config = aiProvider();
  const provider = config.ok ? config.provider : null;

  const { data: run, error: runError } = await admin
    .from("analysis_runs")
    .insert({
      request_id: requestId,
      company_id: request.company_id,
      status: provider ? "running" : "failed",
      stage: provider ? "rooms" : "failed",
      provider: provider?.id ?? null,
      model: provider?.model ?? null,
      simulated: provider?.simulated ?? false,
      started_at: new Date().toISOString(),
      error_code: provider ? null : config.ok ? null : config.reason,
      finished_at: provider ? null : new Date().toISOString(),
    })
    .select("id")
    .single();
  if (runError || !run) return { status: "skipped", reason: "analyse déjà en cours" };

  if (!provider) {
    await admin.from("quote_requests").update({ status: "to_review" }).eq("id", requestId);
    return { status: "failed", runId: run.id, reason: config.ok ? "" : config.reason };
  }

  const fail = async (code: string, message: string) => {
    await admin.from("analysis_runs").update({ status: "failed", stage: "failed", error_code: code, error_message: message, finished_at: new Date().toISOString() }).eq("id", run.id);
    await admin.from("quote_requests").update({ status: "to_review" }).eq("id", requestId);
    return { status: "failed" as const, runId: run.id, reason: message };
  };

  try {
    await admin.from("quote_requests").update({ status: "analyzing" }).eq("id", requestId);

    // Pièces et images extraites
    const [{ data: rooms }, { data: frames }, { data: catalogRows }] = await Promise.all([
      admin.from("rooms").select("id, name, description, position").eq("request_id", requestId).order("position"),
      admin
        .from("video_frames")
        .select("id, storage_path, captured_at_ms, room_videos!inner(room_id, status, created_at)")
        .eq("request_id", requestId)
        .in("room_videos.status", ["uploaded", "ready"])
        .order("captured_at_ms"),
      admin.from("furniture_catalog").select("id, name, synonyms, heavy, handling, moving_volume_min, moving_volume_avg, moving_volume_max, geometric_volume_avg"),
    ]);
    const catalog: CatalogRef[] = (catalogRows ?? []).map((r) => ({
      ...r,
      moving_volume_min: r.moving_volume_min === null ? null : Number(r.moving_volume_min),
      moving_volume_avg: r.moving_volume_avg === null ? null : Number(r.moving_volume_avg),
      moving_volume_max: r.moving_volume_max === null ? null : Number(r.moving_volume_max),
      geometric_volume_avg: r.geometric_volume_avg === null ? null : Number(r.geometric_volume_avg),
    }));
    const catalogText = catalogPrompt(catalog);
    const roomsWithFrames = (rooms ?? [])
      .map((room) => ({ room, frames: spread((frames ?? []).filter((f) => f.room_videos.room_id === room.id), MAX_IMAGES_PER_ROOM) }))
      .filter((r) => r.frames.length > 0);
    if (roomsWithFrames.length === 0) return await fail("no_images", "Aucune image exploitable.");

    await admin
      .from("analysis_runs")
      .update({ stage: "recognition", rooms_total: roomsWithFrames.length, rooms_done: 0, images_count: roomsWithFrames.reduce((n, r) => n + r.frames.length, 0) })
      .eq("id", run.id);

    let usage = emptyUsage();
    const detections: RoomDetections[] = [];
    const raw: Record<string, unknown> = {};
    const failures: string[] = [];
    let modelUsed = provider.model;

    for (const [index, { room, frames: roomFrames }] of roomsWithFrames.entries()) {
      const images: RoomImage[] = [];
      const frameIds: string[] = [];
      for (const frame of roomFrames) {
        const { data: blob } = await admin.storage.from(MEDIA_BUCKET).download(frame.storage_path);
        if (!blob) continue;
        images.push({ mediaType: "image/jpeg", base64: Buffer.from(await blob.arrayBuffer()).toString("base64") });
        frameIds.push(frame.id);
      }
      if (images.length > 0) {
        const result = await provider.analyzeRoom({ roomName: room.name, roomDescription: room.description, images, catalogText });
        usage = addUsage(usage, result.usage);
        modelUsed = result.model;
        if (result.ok) {
          detections.push({ roomId: room.id, objects: result.analysis.objects, frameIds });
          raw[room.id] = result.analysis;
        } else {
          failures.push(`${room.name} : ${result.message}`);
          raw[room.id] = { error: result.code };
        }
      } else {
        failures.push(`${room.name} : images illisibles`);
      }
      await admin.from("analysis_runs").update({ rooms_done: index + 1 }).eq("id", run.id);
    }

    const costUsd = provider.simulated ? 0 : estimateCostUsd(modelUsed, usage);
    await admin
      .from("analysis_runs")
      .update({ stage: "volumes", model: modelUsed, input_tokens: usage.inputTokens + usage.cacheReadTokens + usage.cacheWriteTokens, output_tokens: usage.outputTokens, cost_usd: costUsd, raw_output: raw as Json })
      .eq("id", run.id);

    if (detections.length === 0) return await fail("analysis_failed", failures.join(" ; ") || "Analyse impossible.");

    // Inventaire
    const items = buildItems(detections, new Map(catalog.map((c) => [c.id, c])));
    if (items.length > 0) {
      const { data: insertedItems, error: itemsError } = await admin
        .from("inventory_items")
        .insert(
          items.map((item) => ({
            request_id: requestId,
            company_id: request.company_id,
            room_id: item.roomId,
            analysis_run_id: run.id,
            name: item.name.slice(0, 120),
            ai_label: item.aiLabel.slice(0, 200),
            catalog_key: item.catalogKey,
            quantity: item.quantity,
            unit_volume_m3: item.unitVolumeM3,
            unit_volume_min_m3: item.unitVolumeMinM3,
            unit_volume_max_m3: item.unitVolumeMaxM3,
            geometric_volume_m3: item.geometricVolumeM3,
            volume_source: item.volumeSource,
            visibility: item.visibility,
            length_cm: item.dims?.width ?? null,
            width_cm: item.dims?.depth ?? null,
            height_cm: item.dims?.height ?? null,
            source: "ai" as const,
            confidence: item.confidence,
            possible_duplicate: item.possibleDuplicate,
            duplicate_reason: item.duplicateReason,
            is_heavy: item.isHeavy,
            is_fragile: item.isFragile,
            needs_disassembly: item.needsDisassembly,
            notes: item.notes?.slice(0, 1000) ?? null,
            ai_proposal: item.aiProposal as unknown as Json,
          })),
        )
        .select("id");
      if (itemsError || !insertedItems) return await fail("save_failed", "Inventaire non enregistré.");

      const idByKey = new Map(items.map((item, i) => [item.key, insertedItems[i].id]));
      for (const [i, item] of items.entries()) {
        if (item.duplicateOfKey && idByKey.get(item.duplicateOfKey)) {
          await admin.from("inventory_items").update({ duplicate_of_item_id: idByKey.get(item.duplicateOfKey)! }).eq("id", insertedItems[i].id);
        }
      }
      const links = items.flatMap((item, i) => item.frameIds.map((frameId) => ({ item_id: insertedItems[i].id, frame_id: frameId, company_id: request.company_id })));
      if (links.length > 0) await admin.from("inventory_item_frames").insert(links);
    }

    // Devis initial
    await admin.from("analysis_runs").update({ stage: "pricing" }).eq("id", run.id);
    const { count: declaredRooms } = await admin.from("rooms").select("id", { count: "exact", head: true }).eq("request_id", requestId);
    const quote = await generateQuote(admin, requestId, {
      origin: "automatic",
      analysis: {
        simulated: provider.simulated,
        failedRooms: failures.length,
        roomsWithoutImages: Math.max(0, (declaredRooms ?? 0) - roomsWithFrames.length),
      },
    });
    await admin.from("analysis_runs").update({ stage: "quote" }).eq("id", run.id);

    await admin
      .from("analysis_runs")
      .update({ status: "succeeded", stage: "done", finished_at: new Date().toISOString(), error_message: failures.length ? failures.join(" ; ").slice(0, 2000) : null })
      .eq("id", run.id);
    // Devis formel envoyé automatiquement : la demande est déjà « devis envoyé » ; sinon validation humaine.
    if (!(quote.status === "created" && quote.formal)) {
      await admin.from("quote_requests").update({ status: "to_review" }).eq("id", requestId);
    }
    return { status: "done", runId: run.id, quote: quote.status };
  } catch (error) {
    console.error("[analyse] échec", error);
    return await fail("internal_error", "Erreur interne pendant l'analyse.");
  }
}
