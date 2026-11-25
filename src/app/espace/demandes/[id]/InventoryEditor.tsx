"use client";

import { useActionState } from "react";
import { Check, CopyX, RotateCcw, Trash2 } from "lucide-react";
import { addInventoryItem, updateInventoryItem } from "./inventory-actions";
import { idleState } from "@/lib/errors";
import { TextField, SelectField } from "@/components/ui/Field";
import { SubmitButton } from "@/components/forms/SubmitButton";
import { FormMessage } from "@/components/forms/FormMessage";
import { fieldProps } from "@/components/forms/useFormValues";
import { ConfidenceBadge } from "@/components/ui/ConfidenceBadge";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/components/ui/cn";
import { formatVolume, volumeBucket } from "@/lib/inventory/volume";
import { confidenceLevel } from "@/lib/inventory/confidence";

export type EditableItem = {
  id: string;
  name: string;
  aiLabel: string | null;
  roomId: string | null;
  room: string;
  quantity: number;
  unitVolumeM3: number;
  source: "ai" | "manual";
  confidence?: number;
  validatedByHuman: boolean;
  possibleDuplicate: boolean;
  duplicateReason: string | null;
  removed: boolean;
  volumeSource: string | null;
  isHeavy: boolean;
  frames: number;
};

type Option = { value: string; label: string };

function ItemRow({ item, requestId, rooms }: { item: EditableItem; requestId: string; rooms: Option[] }) {
  const [state, action] = useActionState(updateInventoryItem, idleState);
  const bucket = volumeBucket(item);
  const level = item.confidence === undefined ? null : confidenceLevel(item.confidence);
  const stripe = item.removed
    ? ""
    : item.possibleDuplicate && !item.validatedByHuman
      ? "border-l-duplicate"
      : item.validatedByHuman || item.source === "manual"
        ? "border-l-success"
        : level === "uncertain"
          ? "border-l-danger"
          : level === "verify"
            ? "border-l-warning"
            : "border-l-success";
  return (
    <li className={cn("rounded-md border border-l-4 border-border bg-surface", stripe, item.removed && "opacity-60")}>
      <details>
        <summary className="flex cursor-pointer flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2.5">
          <span className="min-w-0 flex-1">
            <span className={cn("font-medium", item.removed && "line-through")}>
              {item.quantity > 1 ? `${item.quantity} × ` : ""}
              {item.name}
            </span>
            <span className="block text-xs text-ink-muted">
              {item.room}
              {item.isHeavy ? " · objet lourd" : ""}
              {item.volumeSource === "unknown" && !item.validatedByHuman ? " · volume à renseigner" : ""}
              {item.volumeSource === "dimensions" ? " · volume estimé d'après l'image" : ""}
            </span>
          </span>
          {item.removed ? (
            <Badge>Retiré</Badge>
          ) : item.source === "manual" ? (
            <Badge>Ajouté à la main</Badge>
          ) : item.validatedByHuman ? (
            <Badge tone="success">Vérifié</Badge>
          ) : (
            <ConfidenceBadge audience="pro" score={item.confidence ?? 0} possibleDuplicate={item.possibleDuplicate} />
          )}
          <span className="w-20 text-right text-sm tabular-nums">
            {item.removed || bucket === "potential" ? <span className="text-ink-muted">non compté</span> : formatVolume(item.quantity * item.unitVolumeM3)}
          </span>
        </summary>
        <form action={action} className="flex flex-col gap-3 border-t border-border px-3 py-3">
          <input type="hidden" name="id" value={item.id} />
          <input type="hidden" name="request_id" value={requestId} />
          {item.aiLabel && item.aiLabel !== item.name ? <p className="text-xs text-ink-muted">Proposition de l&apos;IA : « {item.aiLabel} »</p> : null}
          {item.possibleDuplicate && !item.removed ? (
            <p className="rounded-md bg-duplicate-soft px-3 py-2 text-xs text-ink">
              <strong>Doublon possible, compté en attendant votre décision.</strong> {item.duplicateReason ?? "Peut-être le même meuble qu'un autre élément de l'inventaire."} Comparez les images : s&apos;il s&apos;agit du même meuble, retirez cet élément ; sinon, indiquez « Pas un doublon ».
            </p>
          ) : null}
          {item.frames > 0 ? <p className="text-xs text-ink-muted">Repéré sur {item.frames} image{item.frames > 1 ? "s" : ""} (voir les vidéos ci-dessous).</p> : null}
          <div className="grid gap-3 sm:grid-cols-[2fr_1fr_1fr]">
            <TextField id={`name-${item.id}`} label="Nom" {...fieldProps(state, "name", item.name)} />
            <TextField id={`qty-${item.id}`} label="Quantité" inputMode="numeric" {...fieldProps(state, "quantity", String(item.quantity))} />
            <TextField id={`vol-${item.id}`} label="Volume unitaire (m³)" inputMode="decimal" {...fieldProps(state, "unit_volume_m3", String(item.unitVolumeM3).replace(".", ","))} />
          </div>
          <SelectField id={`room-${item.id}`} label="Pièce" options={[{ value: "", label: "Sans pièce" }, ...rooms]} {...fieldProps(state, "room_id", item.roomId ?? "")} />
          <FormMessage state={state} />
          <div className="flex flex-wrap gap-2">
            <SubmitButton name="intent" value="save" size="sm" pendingLabel="Enregistrement…">Enregistrer et valider</SubmitButton>
            {!item.validatedByHuman && item.source === "ai" && !item.removed ? (
              <SubmitButton name="intent" value="confirm" size="sm" variant="secondary" pendingLabel="…">
                <Check aria-hidden className="size-4" /> Confirmer tel quel
              </SubmitButton>
            ) : null}
            {item.possibleDuplicate && !item.removed ? (
              <SubmitButton name="intent" value="not_duplicate" size="sm" variant="secondary" pendingLabel="…">
                <CopyX aria-hidden className="size-4" /> Pas un doublon
              </SubmitButton>
            ) : null}
            {item.removed ? (
              <SubmitButton name="intent" value="restore" size="sm" variant="tertiary" pendingLabel="…">
                <RotateCcw aria-hidden className="size-4" /> Rétablir
              </SubmitButton>
            ) : (
              <SubmitButton name="intent" value="remove" size="sm" variant="tertiary" pendingLabel="…">
                <Trash2 aria-hidden className="size-4" /> Retirer
              </SubmitButton>
            )}
          </div>
        </form>
      </details>
    </li>
  );
}

function AddItemForm({ requestId, rooms, catalog }: { requestId: string; rooms: Option[]; catalog: Option[] }) {
  const [state, action] = useActionState(addInventoryItem, idleState);
  return (
    <details className="rounded-md border border-dashed border-border-input bg-surface">
      <summary className="cursor-pointer px-3 py-2.5 text-sm font-medium text-brand">Ajouter un objet</summary>
      <form action={action} className="flex flex-col gap-3 border-t border-border px-3 py-3">
        <input type="hidden" name="request_id" value={requestId} />
        <SelectField id="add-catalog" label="Objet du catalogue" options={[{ value: "", label: "Autre (saisie libre)" }, ...catalog]} {...fieldProps(state, "catalog_key", "")} />
        <div className="grid gap-3 sm:grid-cols-[2fr_1fr_1fr]">
          <TextField id="add-name" label="Nom (si autre)" {...fieldProps(state, "name", "")} />
          <TextField id="add-qty" label="Quantité" inputMode="numeric" {...fieldProps(state, "quantity", "1")} />
          <TextField id="add-vol" label="Volume unitaire (m³)" help="Vide = volume du catalogue" inputMode="decimal" {...fieldProps(state, "unit_volume_m3", "")} />
        </div>
        <SelectField id="add-room" label="Pièce" options={[{ value: "", label: "Sans pièce" }, ...rooms]} {...fieldProps(state, "room_id", "")} />
        <FormMessage state={state} />
        <SubmitButton size="sm" pendingLabel="Ajout…">Ajouter</SubmitButton>
      </form>
    </details>
  );
}

export function InventoryEditor({ requestId, items, rooms, catalog }: { requestId: string; items: EditableItem[]; rooms: Option[]; catalog: Option[] }) {
  const groups = new Map<string, EditableItem[]>();
  for (const item of items) groups.set(item.room, [...(groups.get(item.room) ?? []), item]);
  return (
    <div className="flex flex-col gap-4">
      {[...groups.entries()].map(([room, list]) => (
        <section key={room} className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold text-ink-secondary">{room}</h3>
          <ul className="flex flex-col gap-2">
            {list.map((item) => (
              <ItemRow key={item.id} item={item} requestId={requestId} rooms={rooms} />
            ))}
          </ul>
        </section>
      ))}
      <AddItemForm requestId={requestId} rooms={rooms} catalog={catalog} />
    </div>
  );
}
