"use client";

import { useActionState, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { deleteRoom, saveRoom } from "../../actions";
import { idleState } from "@/lib/errors";
import { TextArea, TextField } from "@/components/ui/Field";
import { SubmitButton } from "@/components/forms/SubmitButton";
import { FormMessage } from "@/components/forms/FormMessage";
import { fieldProps } from "@/components/forms/useFormValues";
import { ROOM_PRESETS } from "@/lib/validation/public-request";
import type { DraftRoom } from "@/lib/public-request/service";
import { cn } from "@/components/ui/cn";

function RoomEditor({ slug, room, onDone }: { slug: string; room?: DraftRoom; onDone?: () => void }) {
  const [preset, setPreset] = useState<string>(room?.room_type ?? "");
  const [name, setName] = useState(room?.name ?? "");
  const [state, action] = useActionState(async (prev: Parameters<typeof saveRoom>[0], fd: FormData) => {
    const result = await saveRoom(prev, fd);
    if (result.status === "success") {
      if (!room) { setName(""); setPreset(""); }
      onDone?.();
    }
    return result;
  }, idleState);
  const prefix = room ? `room-${room.id}` : "new-room";
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="slug" value={slug} />
      {room && <input type="hidden" name="room_id" value={room.id} />}
      <input type="hidden" name="kind" value={preset} />
      {!room && (
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium">Type de pièce</span>
          <div className="flex flex-wrap gap-2">
            {ROOM_PRESETS.map((p) => (
              <button
                key={p.name}
                type="button"
                onClick={() => { setPreset(p.kind); setName(p.name === "Autre" ? "" : p.name); }}
                aria-pressed={name === p.name || (p.name === "Autre" && preset === "other")}
                className={cn(
                  "min-h-11 rounded-full border px-4 text-sm font-medium",
                  name === p.name || (p.name === "Autre" && preset === "other")
                    ? "border-brand bg-brand-soft text-brand-pressed"
                    : "border-border-input bg-surface text-ink hover:bg-surface-subtle",
                )}
              >
                {p.name}
              </button>
            ))}
          </div>
        </div>
      )}
      <TextField id={`${prefix}-name`} name="name" label="Nom de la pièce" value={name} onChange={(e) => setName(e.target.value)}
        error={state.status === "error" ? state.fieldErrors?.name : undefined} placeholder="Ex. : Chambre des enfants" />
      <TextArea id={`${prefix}-desc`} label="Description" optional rows={2} placeholder="Ex. : armoire démontable, piano, objets fragiles…"
        {...fieldProps(state, "description", room?.description)} />
      <FormMessage state={state} />
      <SubmitButton variant={room ? "secondary" : "primary"} pendingLabel="Enregistrement…">
        {room ? "Enregistrer" : <><Plus aria-hidden />Ajouter la pièce</>}
      </SubmitButton>
    </form>
  );
}

function RoomItem({ slug, room }: { slug: string; room: DraftRoom }) {
  const [editing, setEditing] = useState(false);
  const [delState, delAction] = useActionState(deleteRoom, idleState);
  const videos = room.videos.length;
  return (
    <li className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
      {editing ? (
        <RoomEditor slug={slug} room={room} onDone={() => setEditing(false)} />
      ) : (
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-semibold">{room.name}</p>
            {room.description && <p className="text-sm text-ink-secondary">{room.description}</p>}
            <p className="text-xs text-ink-muted">{videos === 0 ? "Pas encore de vidéo" : `${videos} vidéo${videos > 1 ? "s" : ""}`}</p>
          </div>
          <div className="flex shrink-0 gap-1">
            <button type="button" onClick={() => setEditing(true)} className="inline-grid size-11 place-items-center rounded-md text-ink-secondary hover:bg-surface-subtle">
              <Pencil aria-hidden className="size-[18px]" /><span className="sr-only">Modifier {room.name}</span>
            </button>
            <form action={delAction}>
              <input type="hidden" name="slug" value={slug} />
              <input type="hidden" name="room_id" value={room.id} />
              <button type="submit" className="inline-grid size-11 place-items-center rounded-md text-ink-secondary hover:bg-danger-soft hover:text-danger-text"
                onClick={(e) => { if (videos > 0 && !window.confirm(`Supprimer « ${room.name} » et sa vidéo ?`)) e.preventDefault(); }}>
                <Trash2 aria-hidden className="size-[18px]" /><span className="sr-only">Supprimer {room.name}</span>
              </button>
            </form>
          </div>
        </div>
      )}
      <FormMessage state={delState} />
    </li>
  );
}

export function RoomsManager({ slug, rooms }: { slug: string; rooms: DraftRoom[] }) {
  return (
    <div className="flex flex-col gap-6">
      {rooms.length > 0 && (
        <ul className="flex flex-col gap-3" aria-label="Vos pièces">
          {rooms.map((room) => <RoomItem key={room.id} slug={slug} room={room} />)}
        </ul>
      )}
      <section className="flex flex-col gap-4 rounded-lg border border-dashed border-border-input bg-surface p-4 sm:p-6">
        <h2 className="text-lg leading-[26px] font-semibold">{rooms.length === 0 ? "Ajoutez votre première pièce" : "Ajouter une pièce"}</h2>
        <RoomEditor slug={slug} />
      </section>
    </div>
  );
}
