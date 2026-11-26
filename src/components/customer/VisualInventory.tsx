"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Box, Check, ChevronDown, CloudOff, Loader2, Minus, PackagePlus, Plus, Search, Trash2, X } from "lucide-react";
import {
  addCatalogItem, addCustomItem, addRoomAction, changeQuantity, loadInventoryAction, setBoxesAction,
  type InventoryResult, type InventorySnapshot,
} from "@/app/d/[slug]/inventory-actions";
import { searchCatalog, SIZE_CLASSES, type CatalogChoice } from "@/lib/inventory/manual";
import {
  BOX_CATALOG_KEY, detectedBoxes, displayRooms, nextRoomName, parseQuantityInput, ROOM_TABS, tabFor, tabKeyForItem,
  type DisplayRoom, type InventoryRoom, type RoomTabKey,
} from "@/lib/inventory/rooms";
import { sceneKeys } from "@/lib/inventory/scenes";
import { SyncEngine, type SyncOp, type SyncStatus } from "@/lib/inventory/sync-queue";
import type { PublicInventoryItem } from "@/lib/public-request/service";
import { RoomScene } from "./illustrations/RoomScene";
import { QuantityInput } from "./QuantityInput";
import { Button } from "@/components/ui/Button";
import { TextArea, TextField } from "@/components/ui/Field";
import { cn } from "@/components/ui/cn";

const m3 = (n: number) => `${(Math.round(n * 100) / 100).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} m³`;
const VOLUME_NOTE: Record<string, string> = { comparable: "volume d'un objet de taille comparable", dimensions: "volume calculé avec vos dimensions" };

type LocalItem = PublicInventoryItem & { tab?: string; saving?: boolean };
type State = { rooms: InventoryRoom[]; items: LocalItem[]; extraBoxes: number | null };

const fromSnapshot = (s: InventorySnapshot): State => ({ rooms: s.rooms, items: s.items, extraBoxes: s.extra_boxes });

function runOp(slug: string, viewToken: string | null, op: SyncOp): Promise<InventoryResult> {
  switch (op.kind) {
    case "add": return addCatalogItem(slug, viewToken, op.input);
    case "qty": return changeQuantity(slug, viewToken, op.itemId, op.quantity);
    case "boxes": return setBoxesAction(slug, viewToken, op.boxes);
    case "room": return addRoomAction(slug, viewToken, op.base, op.name);
    case "custom": {
      const data = new FormData();
      for (const [k, v] of Object.entries(op.fields)) data.set(k, v);
      return addCustomItem(slug, viewToken, data);
    }
  }
}
let tempCounter = 0;
const tempId = () => `tmp-${Date.now().toString(36)}-${(tempCounter++).toString(36)}`;

/**
 * Inventaire visuel du particulier (parcours v3) : étape des cartons, puis une pièce par onglet avec son
 * illustration interactive, la liste des objets de la pièce, la recherche dans tout le catalogue et l'ajout
 * d'un objet non référencé (« Objet à vérifier »).
 *
 * Fluidité : chaque action met l'écran à jour immédiatement ; l'enregistrement part en arrière-plan (file
 * ordonnée, fusion des appuis rapides). L'état renvoyé par la base fait foi une fois la file vide. En cas de
 * coupure réseau, les modifications restent en attente et repartent au retour de la connexion ; en cas de
 * refus, l'écran se recale sur l'état enregistré et un message l'explique.
 *
 * `viewToken` : lien de suivi (inventaire de l'analyse à valider) ; sinon brouillon du cookie.
 */
export function VisualInventory({ slug, viewToken = null, catalog, initial, footer }: {
  slug: string;
  viewToken?: string | null;
  catalog: CatalogChoice[];
  initial: InventorySnapshot;
  /** Bas de page (envoi ou validation) : reçoit l'état courant pour activer ou non le bouton. */
  footer?: (status: { saving: boolean; boxesAnswered: boolean; itemCount: number; liveIds: ReadonlySet<string>; flush: () => Promise<void> }) => ReactNode;
}) {
  const [state, setState] = useState<State>(() => fromSnapshot(initial));
  const [stage, setStage] = useState<"boxes" | "rooms">(initial.extra_boxes === null ? "boxes" : "rooms");
  const [active, setActive] = useState<string>("salon");
  const [sync, setSync] = useState<SyncStatus>("idle");
  const [notice, setNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [pulse, setPulse] = useState<{ key: string; n: number } | null>(null);
  const [sizeFor, setSizeFor] = useState<string | null>(null);

  const byId = useMemo(() => new Map(catalog.map((c) => [c.id, c])), [catalog]);
  const names = useMemo(() => new Map(catalog.map((c) => [c.id, c.name])), [catalog]);

  // ---------------------------------------------------------------------------------------------------------
  // Enregistrement en arrière-plan (src/lib/inventory/sync-queue.ts)
  // ---------------------------------------------------------------------------------------------------------
  const [engine] = useState(() => {
    const e: SyncEngine<InventorySnapshot, InventoryResult> = new SyncEngine<InventorySnapshot, InventoryResult>({
      run: (op) => runOp(slug, viewToken, op),
      reload: async () => (await loadInventoryAction(slug, viewToken)).inventory ?? null,
      onSnapshot: (snap) => {
        setState(fromSnapshot(snap));
        setActive((tab) => (tab.startsWith("room:tmp-") ? `room:${e.realId(tab.slice(5)) ?? ""}` : tab));
      },
      onStatus: setSync,
      onRefused: (r) => setNotice({ tone: "error", text: `${r.message ?? "Modification refusée."} Votre inventaire a été rechargé tel qu'il est enregistré.` }),
    });
    return e;
  });
  const push = (op: SyncOp) => engine.push(op);
  const flush = useCallback(() => engine.flush(), [engine]);

  useEffect(() => {
    const online = () => engine.retry();
    const leave = (e: BeforeUnloadEvent) => { if (engine.busy) e.preventDefault(); };
    window.addEventListener("online", online);
    window.addEventListener("beforeunload", leave);
    return () => {
      window.removeEventListener("online", online);
      window.removeEventListener("beforeunload", leave);
    };
  }, [engine]);

  // ---------------------------------------------------------------------------------------------------------
  // Données affichées
  // ---------------------------------------------------------------------------------------------------------
  const display = useMemo(() => displayRooms(state.rooms), [state.rooms]);
  const catalogCategory = useCallback((key: string) => byId.get(key)?.category, [byId]);
  const tabOf = useCallback((item: LocalItem) => item.tab ?? tabKeyForItem(item, state.rooms, catalogCategory, display), [state.rooms, catalogCategory, display]);
  const current: DisplayRoom = display.find((d) => d.tabKey === active) ?? display[0];
  const currentItems = state.items.filter((i) => tabOf(i) === current.tabKey);
  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const i of state.items) {
      const t = tabOf(i);
      if (t) map.set(t, (map.get(t) ?? 0) + i.quantity);
    }
    return map;
  }, [state.items, tabOf]);
  const sceneQuantities = useMemo(() => {
    const map = new Map<string, number>();
    for (const i of currentItems) if (i.catalog_key) map.set(i.catalog_key, (map.get(i.catalog_key) ?? 0) + i.quantity);
    return map;
  }, [currentItems]);
  const totalVolume = state.items.reduce((s, i) => s + i.quantity * Number(i.unit_volume_m3), 0);
  const totalCount = state.items.reduce((s, i) => s + i.quantity, 0);
  const aiBoxes = detectedBoxes(state.items);
  const liveIds = useMemo(() => new Set(state.items.map((i) => i.id)), [state.items]);
  const keyOf = (i: LocalItem) => engine.uiKey(i.id);

  // ---------------------------------------------------------------------------------------------------------
  // Actions (mise à jour immédiate, enregistrement en arrière-plan)
  // ---------------------------------------------------------------------------------------------------------
  function setQuantity(item: LocalItem, quantity: number) {
    const q = Math.max(0, Math.min(999, quantity));
    setState((s) => ({ ...s, items: q === 0 ? s.items.filter((i) => i.id !== item.id) : s.items.map((i) => (i.id === item.id ? { ...i, quantity: q } : i)) }));
    push({ kind: "qty", itemId: item.id, quantity: q });
  }

  function add(catalogKey: string, size?: string) {
    const ref = byId.get(catalogKey);
    if (!ref) return;
    const existing = currentItems.find((i) => i.source === "customer" && i.catalog_key === catalogKey && !i.dims && !i.comment && (size === undefined || i.size_class === size));
    setPulse((p) => ({ key: catalogKey, n: (p?.n ?? 0) + 1 }));
    if (existing) {
      setQuantity(existing, existing.quantity + 1);
      setNotice({ tone: "ok", text: `${ref.name} : ${existing.quantity + 1}` });
      return;
    }
    if (ref.volume === null && !size) {
      setSizeFor(catalogKey);
      return;
    }
    setSizeFor(null);
    const id = tempId();
    const item: LocalItem = {
      id, name: ref.name, room: current.label, room_id: current.roomId, room_position: 0, quantity: 1, category: current.base,
      catalog_key: catalogKey, source: "customer", unit_volume_m3: ref.volume ?? 0, volume_source: ref.volume === null ? "comparable" : "catalog",
      size_class: size ?? null, dims: null, comment: null, possible_duplicate: false, duplicate_reason: null, duplicate_of: null,
      customer_decision: null, frames: [], duplicate_frames: [], tab: current.tabKey, saving: true,
    };
    setState((s) => ({ ...s, items: [...s.items, item] }));
    setNotice({ tone: "ok", text: `${ref.name} ajouté.` });
    push({ kind: "add", tempId: id, input: { catalog_key: catalogKey, category: current.base, room_id: current.extra ? current.roomId ?? undefined : undefined, size, quantity: 1 } });
  }

  function setBoxes(boxes: number) {
    setState((s) => ({ ...s, extraBoxes: boxes }));
    push({ kind: "boxes", boxes });
  }

  function addRoom(base: RoomTabKey, name: string) {
    const id = tempId();
    setState((s) => ({ ...s, rooms: [...s.rooms, { id, name, category: `${base}:new` }] }));
    setActive(`room:${id}`);
    push({ kind: "room", tempId: id, base, name });
  }

  function addCustom(fields: Record<string, string>): Promise<InventoryResult> {
    return engine.pushCustom({ ...fields, category: current.base, ...(current.extra && current.roomId ? { room_id: current.roomId } : {}) });
  }

  const saving = sync !== "idle";

  return (
    <div className="flex flex-col gap-6">
      <SyncBadge status={sync} onRetry={() => engine.retry()} />

      {stage === "boxes" ? (
        <BoxesStep initial={state.extraBoxes} detected={aiBoxes} onDone={(n) => { setBoxes(n); setStage("rooms"); }} />
      ) : (
        <>
          <BoxesSummary boxes={state.extraBoxes} detected={aiBoxes} onChange={setBoxes} onEdit={() => setStage("boxes")} />

          <section aria-labelledby="rooms-title" className="flex flex-col gap-4">
            <h2 id="rooms-title" className="text-[20px] leading-[28px] font-bold">Vos meubles, pièce par pièce</h2>
            <RoomTabs display={display} active={current.tabKey} counts={counts} onSelect={(k) => { setActive(k); setSizeFor(null); }} onAddRoom={addRoom} />

            <div role="tabpanel" aria-label={current.label} className="flex flex-col gap-4" data-testid="room-panel" data-room={current.tabKey}>
              <RoomScene tab={current.base} names={names} quantities={sceneQuantities} pulse={pulse} onPick={(k) => add(k)} />
              {sizeFor ? <SizeChooser name={names.get(sizeFor) ?? ""} onPick={(size) => add(sizeFor, size)} onCancel={() => setSizeFor(null)} /> : null}
              <p role="status" aria-live="polite" className={cn("min-h-5 text-sm", notice?.tone === "error" ? "text-danger-text" : "text-success-text")}>{notice?.text}</p>

              <RoomList room={current} items={currentItems} keyOf={keyOf} onQuantity={setQuantity} />
              <CatalogPicker room={current} catalog={catalog} quantities={sceneQuantities} onAdd={(k) => add(k)} onRemoveOne={(k) => {
                const item = currentItems.find((i) => i.catalog_key === k && i.source === "customer");
                if (item) setQuantity(item, item.quantity - 1);
              }} />
              <CustomItem room={current} onSubmit={addCustom} onAdded={(label) => setNotice({ tone: "ok", text: `« ${label} » ajouté : objet à vérifier par votre déménageur.` })} />
            </div>
          </section>

          <div className="sticky bottom-0 z-10 -mx-4 flex items-center justify-between gap-3 border-t border-border bg-surface/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-lg sm:border" data-testid="inventory-total">
            <span className="text-sm text-ink-secondary">Total : {totalCount} objet{totalCount > 1 ? "s" : ""}</span>
            <strong className="text-base tabular-nums" data-testid="inventory-volume">{m3(totalVolume)}</strong>
          </div>
        </>
      )}

      {stage === "rooms" && footer ? footer({ saving, boxesAnswered: state.extraBoxes !== null, itemCount: state.items.length, liveIds, flush }) : null}
    </div>
  );
}

// -----------------------------------------------------------------------------------------------------------
// Cartons
// -----------------------------------------------------------------------------------------------------------
function BoxesStep({ initial, detected, onDone }: { initial: number | null; detected: number; onDone: (n: number) => void }) {
  const [value, setValue] = useState(initial === null ? "" : String(initial));
  const [error, setError] = useState<string | null>(null);
  return (
    <section aria-labelledby="boxes-title" className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-4 sm:p-6" data-testid="boxes-step">
      <div className="flex items-start gap-3">
        <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-md bg-brand-soft text-brand"><Box aria-hidden className="size-5" /></span>
        <div className="flex flex-col gap-1">
          <h2 id="boxes-title" className="text-[20px] leading-[28px] font-bold">Commençons par estimer vos cartons</h2>
          <p className="text-sm text-ink-secondary">
            Indiquez le nombre de cartons supplémentaires nécessaires pour votre déménagement. Pensez également aux petits objets et affaires personnelles de taille comparable à un carton ou pouvant y être rangés.
          </p>
        </div>
      </div>
      {detected > 0 ? (
        <p className="rounded-md bg-brand-soft p-3 text-sm" data-testid="boxes-detected">
          L&apos;analyse de vos médias a déjà repéré <strong>{detected} carton{detected > 1 ? "s" : ""}</strong> : {detected > 1 ? "ils sont" : "il est"} déjà compté{detected > 1 ? "s" : ""} dans votre inventaire. Indiquez seulement les cartons <strong>en plus</strong> de ceux-ci.
        </p>
      ) : null}
      <form noValidate className="flex flex-col gap-3" onSubmit={(e) => {
        e.preventDefault();
        const parsed = parseQuantityInput(value);
        if (!parsed.ok) return setError(parsed.message);
        if (parsed.value === null) return setError("Indiquez un nombre de cartons (0 si vous n'en avez pas besoin).");
        onDone(parsed.value);
      }}>
        <label htmlFor="extra-boxes" className="text-sm font-medium">Nombre de cartons supplémentaires</label>
        <div className="flex items-center gap-3">
          <input id="extra-boxes" name="extra_boxes" type="text" inputMode="numeric" pattern="[0-9]*" autoComplete="off" required placeholder="10"
            value={value} aria-invalid={error ? true : undefined} aria-describedby={error ? "extra-boxes-error" : "extra-boxes-hint"}
            onChange={(e) => {
              const raw = e.currentTarget.value;
              const digits = raw.replace(/[^0-9]/g, "");
              setValue(digits);
              setError(digits !== raw ? "Chiffres uniquement : un nombre entier, 0 accepté." : null);
            }}
            className={cn("h-12 w-32 rounded-md border bg-surface px-3 text-base tabular-nums placeholder:text-ink-disabled focus:border-brand focus:shadow-[0_0_0_3px_var(--ds-brand-soft-strong)] focus:outline-none",
              error ? "border-danger" : "border-border-input")} />
          <span className="text-sm text-ink-secondary">carton{value !== "1" ? "s" : ""}</span>
        </div>
        {error ? <p id="extra-boxes-error" role="alert" className="text-sm text-danger-text">{error}</p> : <p id="extra-boxes-hint" className="text-xs text-ink-muted">Saisissez 0 si vous n&apos;avez pas besoin de cartons supplémentaires.</p>}
        <Button type="submit" size="lg" className="self-start" data-testid="boxes-continue">Continuer vers mes meubles</Button>
      </form>
    </section>
  );
}

function BoxesSummary({ boxes, detected, onChange, onEdit }: { boxes: number | null; detected: number; onChange: (n: number) => void; onEdit: () => void }) {
  return (
    <section aria-label="Cartons" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface p-4" data-testid="boxes-summary">
      <span className="flex items-center gap-3">
        <Box aria-hidden className="size-5 text-brand" />
        <span className="flex flex-col">
          <span className="font-medium">Cartons supplémentaires</span>
          {detected > 0 ? <span className="text-xs text-ink-muted">en plus des {detected} carton{detected > 1 ? "s" : ""} repéré{detected > 1 ? "s" : ""} par l&apos;analyse</span> : null}
        </span>
      </span>
      {boxes === null ? (
        <Button variant="secondary" onClick={onEdit}>Indiquer mes cartons</Button>
      ) : (
        <span className="flex items-center gap-1">
          <StepButton label="Un carton de moins" disabled={boxes <= 0} onClick={() => onChange(boxes - 1)}><Minus aria-hidden className="size-4" /></StepButton>
          <QuantityInput value={boxes} min={0} label="Nombre de cartons supplémentaires" onCommit={onChange} testId="boxes-quantity" />
          <StepButton label="Un carton de plus" disabled={boxes >= 999} onClick={() => onChange(boxes + 1)}><Plus aria-hidden className="size-4" /></StepButton>
        </span>
      )}
    </section>
  );
}

// -----------------------------------------------------------------------------------------------------------
// Onglets des pièces
// -----------------------------------------------------------------------------------------------------------
function RoomTabs({ display, active, counts, onSelect, onAddRoom }: {
  display: DisplayRoom[]; active: string; counts: ReadonlyMap<string, number>; onSelect: (key: string) => void; onAddRoom: (base: RoomTabKey, name: string) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [base, setBase] = useState<RoomTabKey>("chambres");
  const [name, setName] = useState("");
  const proposed = nextRoomName(tabFor(base)!, display.map((d) => d.label));
  return (
    <div className="flex flex-col gap-3">
      <div role="tablist" aria-label="Pièces" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
        {display.map((d) => {
          const n = counts.get(d.tabKey) ?? 0;
          const selected = d.tabKey === active;
          return (
            <button key={d.tabKey} type="button" role="tab" aria-selected={selected} onClick={() => onSelect(d.tabKey)} data-testid="room-tab"
              className={cn("inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-medium",
                selected ? "border-brand bg-brand text-on-brand" : "border-border-input bg-surface text-ink hover:bg-surface-subtle")}>
              {d.label}
              {n > 0 ? <span className={cn("rounded-full px-1.5 text-xs tabular-nums", selected ? "bg-on-brand/20" : "bg-brand-soft text-brand-pressed")}>{n}</span> : null}
            </button>
          );
        })}
        <button type="button" onClick={() => { setAdding((v) => !v); setName(""); }} aria-expanded={adding}
          className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border border-dashed border-brand px-4 text-sm font-semibold text-brand hover:bg-brand-soft" data-testid="add-room">
          <Plus aria-hidden className="size-4" /> Ajouter une pièce
        </button>
      </div>
      {adding ? (
        <form className="flex flex-col gap-3 rounded-lg border border-border bg-surface-subtle p-4 sm:flex-row sm:items-end" onSubmit={(e) => {
          e.preventDefault();
          onAddRoom(base, (name.trim() || proposed).slice(0, 80));
          setAdding(false);
        }}>
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            Type de pièce
            <select value={base} onChange={(e) => setBase(e.currentTarget.value as RoomTabKey)} className="h-12 rounded-md border border-border-input bg-surface px-3 text-base sm:h-10 sm:text-[15px]">
              {ROOM_TABS.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
            </select>
          </label>
          <label className="flex flex-1 flex-col gap-1.5 text-sm font-medium">
            Nom
            <input value={name} onChange={(e) => setName(e.currentTarget.value)} placeholder={proposed} maxLength={80}
              className="h-12 rounded-md border border-border-input bg-surface px-3 text-base placeholder:text-ink-muted sm:h-10 sm:text-[15px]" />
          </label>
          <Button type="submit">Ajouter</Button>
        </form>
      ) : null}
    </div>
  );
}

// -----------------------------------------------------------------------------------------------------------
// Liste de la pièce, catalogue, objet non référencé
// -----------------------------------------------------------------------------------------------------------
function StepButton({ label, disabled, onClick, children, danger = false }: { label: string; disabled?: boolean; onClick: () => void; children: ReactNode; danger?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-label={label}
      className={cn("inline-flex size-11 items-center justify-center rounded-md disabled:opacity-40 sm:size-9",
        danger ? "text-danger-text hover:bg-danger-soft" : "border border-border-input hover:bg-surface-subtle")}>
      {children}
    </button>
  );
}

function RoomList({ room, items, keyOf, onQuantity }: { room: DisplayRoom; items: LocalItem[]; keyOf: (i: LocalItem) => string; onQuantity: (i: LocalItem, q: number) => void }) {
  const volume = items.reduce((s, i) => s + i.quantity * Number(i.unit_volume_m3), 0);
  return (
    <section aria-label={`Objets : ${room.label}`} className="rounded-lg border border-border bg-surface p-4" data-testid="room-list">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="font-semibold">{room.label}</h3>
        <span className="text-sm text-ink-secondary tabular-nums">{m3(volume)}</span>
      </div>
      {items.length === 0 ? (
        <p className="mt-2 text-sm text-ink-secondary">Aucun objet dans cette pièce pour l&apos;instant.</p>
      ) : (
        <ul className="mt-1 divide-y divide-border">
          {items.map((item) => <ItemRow key={keyOf(item)} item={item} onQuantity={(q) => onQuantity(item, q)} />)}
        </ul>
      )}
    </section>
  );
}

function ItemRow({ item, onQuantity }: { item: LocalItem; onQuantity: (q: number) => void }) {
  const note = item.volume_source ? VOLUME_NOTE[item.volume_source] : undefined;
  const custom = item.catalog_key === null;
  return (
    <li className="flex items-center justify-between gap-3 py-2" data-testid="inventory-item" data-catalog-key={item.catalog_key ?? ""}>
      <span className="min-w-0">
        <span className="flex flex-wrap items-center gap-1.5">
          <span>{item.name}</span>
          {custom ? <span className="rounded-full bg-warning-soft px-2 py-0.5 text-xs font-medium text-warning-text">Objet à vérifier</span> : null}
          {item.possible_duplicate ? <span className="rounded-full bg-duplicate-soft px-2 py-0.5 text-xs font-medium text-duplicate-text">À vérifier</span> : null}
          {item.saving ? <Loader2 aria-label="Enregistrement" className="size-3.5 animate-spin text-ink-muted" /> : null}
        </span>
        <span className="block text-xs text-ink-muted">
          {item.source === "ai" ? "Repéré dans vos médias · " : ""}
          {custom ? `volume estimé, à confirmer${note ? ` (${note})` : ""}` : `${m3(Number(item.unit_volume_m3))} l'unité${note ? ` · ${note}` : ""}`}
        </span>
        {item.comment ? <span className="block text-xs text-ink-secondary">« {item.comment} »</span> : null}
      </span>
      <span className="flex shrink-0 items-center gap-1">
        <StepButton label={`Diminuer la quantité : ${item.name}`} disabled={item.quantity <= 1} onClick={() => onQuantity(item.quantity - 1)}><Minus aria-hidden className="size-4" /></StepButton>
        <QuantityInput value={item.quantity} label={`Quantité : ${item.name}`} onCommit={onQuantity} />
        <StepButton label={`Augmenter la quantité : ${item.name}`} disabled={item.quantity >= 999} onClick={() => onQuantity(item.quantity + 1)}><Plus aria-hidden className="size-4" /></StepButton>
        <StepButton danger label={`Retirer : ${item.name}`} onClick={() => onQuantity(0)}><Trash2 aria-hidden className="size-4" /></StepButton>
      </span>
    </li>
  );
}

function SizeChooser({ name, onPick, onCancel }: { name: string; onPick: (size: string) => void; onCancel: () => void }) {
  return (
    <div className="flex flex-col gap-2 rounded-md border border-brand/40 bg-brand-soft/40 p-3" data-testid="size-chooser">
      <p className="text-sm"><strong>{name}</strong> : quelle est sa taille, environ ? <span className="text-ink-secondary">(nous n&apos;avons pas de volume de référence pour cet objet)</span></p>
      <div className="grid grid-cols-2 gap-2">
        {SIZE_CLASSES.map((s) => (
          <button key={s.value} type="button" onClick={() => onPick(s.value)}
            className="flex min-h-12 flex-col items-start justify-center rounded-md border border-border-input bg-surface px-3 py-1.5 text-left text-sm font-medium hover:border-brand">
            {s.label}<span className="text-xs font-normal text-ink-muted">{s.hint}</span>
          </button>
        ))}
      </div>
      <button type="button" onClick={onCancel} className="self-start text-sm text-ink-secondary underline">Annuler</button>
    </div>
  );
}

function CatalogPicker({ room, catalog, quantities, onAdd, onRemoveOne }: {
  room: DisplayRoom; catalog: CatalogChoice[]; quantities: ReadonlyMap<string, number>; onAdd: (key: string) => void; onRemoveOne: (key: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const tab = tabFor(room.base)!;
  const onScene = useMemo(() => new Set(sceneKeys(room.base)), [room.base]);
  const roomObjects = useMemo(
    () => catalog.filter((c) => tab.catalog.includes(c.category) || onScene.has(c.id)).filter((c) => c.id !== BOX_CATALOG_KEY).sort((a, b) => a.name.localeCompare(b.name, "fr")),
    [catalog, tab, onScene],
  );
  const results = query.trim() ? searchCatalog(catalog, query, 25) : null;
  const list = results ?? (open ? roomObjects : []);
  return (
    <section aria-label="Ajouter d'autres objets" className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
      <label className="relative block">
        <span className="sr-only">Rechercher dans tout le catalogue</span>
        <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-muted" />
        <input type="search" value={query} onChange={(e) => setQuery(e.currentTarget.value)} placeholder="Rechercher un objet : canapé, frigo, vélo…" data-testid="catalog-search"
          className="h-12 w-full rounded-md border border-border-input bg-surface pr-3 pl-9 text-base focus:border-brand focus:shadow-[0_0_0_3px_var(--ds-brand-soft-strong)] focus:outline-none sm:h-10 sm:text-[15px]" />
      </label>
      {results ? (
        <p className="text-sm text-ink-secondary">{results.length} résultat{results.length > 1 ? "s" : ""} dans tout le catalogue · ajouté{results.length > 1 ? "s" : ""} dans « {room.label} »</p>
      ) : (
        <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} data-testid="room-catalog-toggle"
          className="flex min-h-11 items-center justify-between gap-2 rounded-md border border-border-input bg-surface px-3 text-left text-sm font-medium hover:bg-surface-subtle">
          Tous les objets : {tab.label} ({roomObjects.length})
          <ChevronDown aria-hidden className={cn("size-4 transition-transform", open && "rotate-180")} />
        </button>
      )}
      {list.length > 0 ? (
        <ul className="-mx-1 flex max-h-[24rem] flex-col divide-y divide-border overflow-y-auto overscroll-contain px-1">
          {list.map((c) => {
            const qty = quantities.get(c.id) ?? 0;
            return (
              <li key={c.id} className="flex items-center justify-between gap-3 py-2" data-testid="catalog-item">
                <span className="min-w-0 font-medium">{c.name}</span>
                <span className="flex shrink-0 items-center gap-1">
                  {qty > 0 ? (
                    <>
                      <StepButton label={`Retirer un ${c.name}`} onClick={() => onRemoveOne(c.id)}><Minus aria-hidden className="size-4" /></StepButton>
                      <span className="w-8 text-center font-semibold tabular-nums">{qty}</span>
                    </>
                  ) : null}
                  <button type="button" onClick={() => onAdd(c.id)} aria-label={`Ajouter un ${c.name}`}
                    className="inline-flex size-11 items-center justify-center rounded-md border border-brand bg-brand-soft text-brand-pressed hover:bg-brand-soft-strong sm:size-9">
                    <Plus aria-hidden className="size-4" />
                  </button>
                </span>
              </li>
            );
          })}
        </ul>
      ) : results ? (
        <p className="text-sm text-ink-secondary">Aucun objet ne correspond. Ajoutez-le ci-dessous comme objet non référencé.</p>
      ) : null}
    </section>
  );
}

function CustomItem({ room, onSubmit, onAdded }: { room: DisplayRoom; onSubmit: (fields: Record<string, string>) => Promise<InventoryResult>; onAdded: (label: string) => void }) {
  const [open, setOpen] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  if (!open) {
    return (
      <p className="text-sm">
        Votre objet n&apos;est pas dans la liste ?{" "}
        <button type="button" onClick={() => setOpen(true)} className="inline-flex min-h-11 items-center gap-1 font-semibold text-brand hover:underline" data-testid="custom-item-open">
          <PackagePlus aria-hidden className="size-4" /> Ajouter un objet non référencé
        </button>
      </p>
    );
  }
  return (
    <form className="flex flex-col gap-4 rounded-md border border-brand/40 bg-brand-soft/40 p-4" noValidate data-testid="custom-item-form"
      onSubmit={async (e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const fields = Object.fromEntries([...new FormData(form).entries()].map(([k, v]) => [k, String(v)]));
        setPending(true);
        const result = await onSubmit(fields);
        setPending(false);
        if (result.ok) {
          form.reset();
          setErrors({});
          setMessage(null);
          setOpen(false);
          onAdded(fields.label);
        } else {
          setErrors(result.fieldErrors ?? {});
          setMessage(result.message);
        }
      }}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-semibold">Objet non référencé · {room.label}</h3>
        <button type="button" onClick={() => setOpen(false)} aria-label="Fermer" className="inline-flex size-10 items-center justify-center rounded-md hover:bg-surface"><X aria-hidden className="size-4" /></button>
      </div>
      <p className="text-xs text-ink-secondary">Il apparaîtra comme « Objet à vérifier » : votre déménageur confirmera son volume.</p>
      <div className="grid grid-cols-[1fr_6rem] gap-4">
        <TextField id="custom-label" name="label" label="Nom de l'objet" placeholder="Ex. : statue, jukebox…" error={errors.label} />
        <TextField id="custom-quantity" name="quantity" label="Quantité" inputMode="numeric" defaultValue="1" error={errors.quantity} />
      </div>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium">Taille approximative</legend>
        <div className="grid grid-cols-2 gap-2">
          {SIZE_CLASSES.map((s) => (
            <label key={s.value} className="flex min-h-12 cursor-pointer flex-col justify-center rounded-md border border-border-input bg-surface px-3 py-1.5 text-sm font-medium has-[:checked]:border-brand has-[:checked]:ring-1 has-[:checked]:ring-brand">
              <input type="radio" name="size" value={s.value} className="sr-only" />
              {s.label}<span className="text-xs font-normal text-ink-muted">{s.hint}</span>
            </label>
          ))}
        </div>
        {errors.size ? <p className="text-xs text-danger-text">{errors.size}</p> : null}
      </fieldset>
      <details className="rounded-md border border-border bg-surface p-3" open={Boolean(errors.width_cm || errors.depth_cm || errors.height_cm) || undefined}>
        <summary className="cursor-pointer text-sm font-medium text-brand">Je connais ses dimensions (facultatif, plus précis)</summary>
        <div className="mt-3 grid grid-cols-3 gap-3">
          <TextField id="custom-w" name="width_cm" label="Largeur (cm)" inputMode="numeric" error={errors.width_cm} />
          <TextField id="custom-d" name="depth_cm" label="Profondeur (cm)" inputMode="numeric" error={errors.depth_cm} />
          <TextField id="custom-h" name="height_cm" label="Hauteur (cm)" inputMode="numeric" error={errors.height_cm} />
        </div>
      </details>
      <TextArea id="custom-comment" name="comment" label="Description" optional rows={2} placeholder="Matière, fragile, démontable, très lourd…" error={errors.comment} />
      {message ? <p className="text-sm text-danger-text">{message}</p> : null}
      <Button type="submit" disabled={pending}>{pending ? "Ajout…" : "Ajouter cet objet"}</Button>
    </form>
  );
}

function SyncBadge({ status, onRetry }: { status: SyncStatus; onRetry: () => void }) {
  if (status === "offline") {
    return (
      <div role="alert" className="flex flex-wrap items-center gap-2 rounded-md border border-warning bg-warning-soft p-3 text-sm" data-testid="sync-offline">
        <CloudOff aria-hidden className="size-4 text-warning-text" />
        Connexion perdue : vos dernières modifications sont gardées sur cet appareil et seront enregistrées dès le retour de la connexion.
        <button type="button" onClick={onRetry} className="font-semibold text-brand underline">Réessayer maintenant</button>
      </div>
    );
  }
  return (
    <p className="-mb-4 flex min-h-5 items-center justify-end gap-1.5 text-xs text-ink-muted" aria-live="polite" data-testid="sync-status" data-status={status}>
      {status === "saving" ? <><Loader2 aria-hidden className="size-3.5 animate-spin" /> Enregistrement…</> : <><Check aria-hidden className="size-3.5" /> Enregistré</>}
    </p>
  );
}

