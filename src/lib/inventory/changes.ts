/**
 * Lecture de l'historique des corrections (inventory_item_changes) pour les e-mails, le dossier de
 * vérification et le suivi du client.
 */
export type ChangeRow = {
  action: string;
  actor?: string;
  changes: unknown;
  volume_before_m3: number | string | null;
  volume_after_m3: number | string | null;
  item_name?: string | null;
};

export type ChangeKind = "added" | "removed" | "corrected";
export type DescribedChange = { kind: ChangeKind; label: string; volumeDeltaM3: number };

const m3 = (v: number) => `${v.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} m³`;
const FIELD_LABELS: Record<string, string> = { name: "nom", quantity: "quantité", unit_volume_m3: "volume unitaire", room_id: "pièce", removed: "retrait", possible_duplicate: "doublon possible" };

/**
 * Corrections qui modifient réellement l'inventaire, dans l'ordre. Une confirmation (« confirm »),
 * même d'une réponse du client, n'est pas une modification.
 */
export function describeChanges(rows: readonly ChangeRow[]): DescribedChange[] {
  const out: DescribedChange[] = [];
  for (const r of rows) {
    if (r.action === "confirm" || r.action === "customer_decision") continue;
    const c = (r.changes ?? {}) as Record<string, unknown>;
    const before = Number(r.volume_before_m3 ?? 0);
    const after = Number(r.volume_after_m3 ?? 0);
    const delta = Math.round((after - before) * 1000) / 1000;
    const field = c.name;
    const name = String(field && typeof field === "object" ? ((field as { apres?: unknown }).apres ?? r.item_name ?? "objet") : (field ?? r.item_name ?? "objet"));
    if (r.action === "add") {
      out.push({ kind: "added", label: `${c.quantity && Number(c.quantity) > 1 ? `${c.quantity} × ` : ""}${name} (${m3(after)})`, volumeDeltaM3: delta });
    } else if (r.action === "remove") {
      out.push({ kind: "removed", label: `${name} (${m3(before)})`, volumeDeltaM3: delta });
    } else if (r.action === "restore") {
      out.push({ kind: "added", label: `${name} rétabli (${m3(after)})`, volumeDeltaM3: delta });
    } else if (r.action === "duplicate_decision") {
      const decision = c.decision === "same" ? "compté une seule fois (même meuble)" : "compté comme un autre meuble";
      out.push({ kind: delta < 0 ? "removed" : delta > 0 ? "added" : "corrected", label: `${name} : ${decision}`, volumeDeltaM3: delta });
    } else {
      const fields = Object.entries(c)
        .filter(([, v]) => v && typeof v === "object" && "avant" in (v as object))
        .map(([k, v]) => `${FIELD_LABELS[k] ?? k} ${String((v as { avant: unknown }).avant)} → ${String((v as { apres: unknown }).apres)}`);
      if (fields.length === 0 && delta === 0) continue;
      out.push({ kind: "corrected", label: `${name}${fields.length ? ` (${fields.join(", ")})` : ""}`, volumeDeltaM3: delta });
    }
  }
  return out;
}
