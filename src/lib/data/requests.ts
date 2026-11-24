import "server-only";
import { createClient } from "@/lib/supabase/server";
import { dbErrorMessage } from "@/lib/errors";
import { STATUS_FILTERS, type RequestStatus, type StatusFilter } from "@/lib/requests/status";
import type { InventoryItem } from "@/lib/inventory/volume";
import type { Database } from "@/lib/supabase/database.types";

/**
 * Lecture des demandes. Le client Supabase est celui de l'utilisateur :
 * les règles RLS limitent automatiquement les résultats à son entreprise.
 * On filtre aussi explicitement par company_id (double protection, et index utilisés).
 */

type Tables = Database["public"]["Tables"];
export type RequestRow = Tables["quote_requests"]["Row"];
export type DwellingRow = Tables["dwellings"]["Row"];

export class DataError extends Error {}

const PENDING: RequestStatus[] = ["submitted", "analyzing", "to_review"];

export async function countPendingRequests(companyId: string): Promise<number> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("quote_requests")
    .select("id", { count: "exact", head: true })
    .eq("company_id", companyId)
    .in("status", PENDING);
  if (error) throw new DataError(dbErrorMessage(error, "countPendingRequests"));
  return count ?? 0;
}

export type RequestListItem = {
  id: string;
  request_number: number;
  status: RequestStatus;
  source: RequestRow["source"];
  moving_date: string | null;
  created_at: string;
  estimated_volume_m3: number | null;
  customer: { full_name: string; email: string | null; phone: string | null } | null;
  origin_city: string | null;
  destination_city: string | null;
};

export async function listRequests(companyId: string, filter: StatusFilter = "toutes", limit = 100): Promise<RequestListItem[]> {
  const supabase = await createClient();
  let query = supabase
    .from("quote_requests")
    .select(
      "id, request_number, status, source, moving_date, created_at, estimated_volume_m3, customer:customers(full_name, email, phone), dwellings(kind, city)",
    )
    .eq("company_id", companyId)
    .neq("status", "draft")
    .order("created_at", { ascending: false })
    .limit(limit);
  const statuses = STATUS_FILTERS[filter].statuses;
  if (statuses) query = query.in("status", [...statuses]);
  const { data, error } = await query;
  if (error) throw new DataError(dbErrorMessage(error, "listRequests"));
  return (data ?? []).map((r) => ({
    id: r.id,
    request_number: r.request_number,
    status: r.status,
    source: r.source,
    moving_date: r.moving_date,
    created_at: r.created_at,
    estimated_volume_m3: r.estimated_volume_m3,
    customer: r.customer,
    origin_city: r.dwellings.find((d) => d.kind === "origin")?.city ?? null,
    destination_city: r.dwellings.find((d) => d.kind === "destination")?.city ?? null,
  }));
}

export type DashboardStats = { total: number; byStatus: Record<RequestStatus, number> };

export async function dashboardStats(companyId: string): Promise<DashboardStats> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("quote_requests").select("status").eq("company_id", companyId).neq("status", "draft");
  if (error) throw new DataError(dbErrorMessage(error, "dashboardStats"));
  const byStatus = Object.fromEntries(
    (["draft", "submitted", "analyzing", "to_review", "quote_sent", "accepted", "refused", "cancelled", "archived"] as const).map((s) => [s, 0]),
  ) as Record<RequestStatus, number>;
  for (const row of data ?? []) byStatus[row.status] += 1;
  return { total: data?.length ?? 0, byStatus };
}

export async function getRequestDetail(companyId: string, requestId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("quote_requests")
    .select(
      `*,
       customer:customers(*),
       dwellings(*),
       rooms(*, room_videos(id, status, storage_path, mime_type, size_bytes, duration_seconds, width, height, processing, encoder, capture_source, original_size_bytes, original_width, original_height, uploaded_at, delete_after, deleted_at, created_at, video_frames(id, storage_path, captured_at_ms))),
       inventory_items(*, inventory_item_frames(frame_id)),
       request_events(id, event_type, from_status, to_status, message, created_at, actor_user_id)`,
    )
    .eq("company_id", companyId)
    .eq("id", requestId)
    .maybeSingle();
  if (error) throw new DataError(dbErrorMessage(error, "getRequestDetail"));
  return data;
}

export type RequestDetail = NonNullable<Awaited<ReturnType<typeof getRequestDetail>>>;

/** Convertit les lignes d'inventaire de la base vers le modèle de calcul du volume. */
export function toInventoryItems(rows: Tables["inventory_items"]["Row"][], roomNames: Map<string, string>): InventoryItem[] {
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    room: (r.room_id && roomNames.get(r.room_id)) || "Sans pièce",
    quantity: r.quantity,
    unitVolumeM3: Number(r.unit_volume_m3),
    source: r.source === "ai" ? "ai" : "manual",
    confidence: r.confidence === null ? undefined : Number(r.confidence),
    validatedByHuman: r.validated_by_human,
    possibleDuplicate: r.possible_duplicate,
    removed: r.removed,
  }));
}
