/**
 * File d'enregistrement de l'inventaire du client (mise à jour immédiate de l'écran, enregistrement en
 * arrière-plan). Les opérations partent une par une, dans l'ordre ; tant qu'une opération n'est pas partie,
 * une nouvelle modification du même objet la remplace (appuis rapides sur « + » : un seul enregistrement de
 * la quantité finale). Module pur (node --test).
 */
export type AddInput = { catalog_key: string; category: string; room_id?: string; size?: string; quantity: number };

export type SyncOp =
  | { kind: "add"; tempId: string; input: AddInput }
  | { kind: "qty"; itemId: string; quantity: number }
  | { kind: "boxes"; boxes: number }
  | { kind: "room"; tempId: string; base: string; name: string }
  | { kind: "custom"; fields: Record<string, string>; ticket: number };

export const isTempId = (id: string | null | undefined): boolean => typeof id === "string" && id.startsWith("tmp-");

/** Ajoute une opération à la file (opérations non encore parties), en fusionnant ce qui peut l'être. */
export function enqueueOp(queue: readonly SyncOp[], op: SyncOp): SyncOp[] {
  const next = [...queue];
  if (op.kind === "qty") {
    const add = next.findIndex((q) => q.kind === "add" && q.tempId === op.itemId);
    if (add >= 0) {
      const pending = next[add] as Extract<SyncOp, { kind: "add" }>;
      if (op.quantity <= 0) {
        // Objet ajouté puis retiré avant tout enregistrement : rien à envoyer (ni ses changements de quantité).
        return next.filter((q, i) => i !== add && !(q.kind === "qty" && q.itemId === op.itemId));
      }
      next[add] = { ...pending, input: { ...pending.input, quantity: op.quantity } };
      return next;
    }
    const same = next.findIndex((q) => q.kind === "qty" && q.itemId === op.itemId);
    if (same >= 0) {
      next[same] = op;
      return next;
    }
  }
  if (op.kind === "boxes") {
    const same = next.findIndex((q) => q.kind === "boxes");
    if (same >= 0) {
      next[same] = op;
      return next;
    }
  }
  next.push(op);
  return next;
}

/** Remplace les identifiants provisoires (objet ou pièce créés hors ligne) par ceux de la base. */
export function resolveIds(op: SyncOp, ids: ReadonlyMap<string, string>): SyncOp {
  const real = (id: string | undefined) => (id && ids.get(id)) || id;
  switch (op.kind) {
    case "qty": return { ...op, itemId: real(op.itemId)! };
    case "add": return op.input.room_id ? { ...op, input: { ...op.input, room_id: real(op.input.room_id) } } : op;
    case "custom": return op.fields.room_id ? { ...op, fields: { ...op.fields, room_id: real(op.fields.room_id)! } } : op;
    default: return op;
  }
}

/** Erreur réseau (connexion perdue, serveur injoignable) : l'opération est conservée et retentée. */
export function isNetworkError(error: unknown): boolean {
  const text = String((error as { message?: string })?.message ?? error);
  return error instanceof TypeError || /network|fetch|failed to fetch|load failed|offline|connection/i.test(text);
}

export type SyncResult<S> = { ok: boolean; id?: string; message?: string; inventory?: S | null };
export type SyncStatus = "idle" | "saving" | "offline";

type Hooks<S, R extends SyncResult<S>> = {
  run: (op: SyncOp) => Promise<R>;
  reload: () => Promise<S | null>;
  onSnapshot: (snapshot: S) => void;
  onStatus: (status: SyncStatus) => void;
  onRefused: (result: R) => void;
  sleep?: (ms: number) => Promise<void>;
};

/**
 * Moteur d'enregistrement : une opération à la fois, dans l'ordre. Coupure réseau : l'opération est remise en
 * tête de file, retentée 3 fois (1,5 s, 3 s, 4,5 s), puis l'état passe « hors connexion » sans rien perdre
 * (retry() au retour de la connexion). Refus de la base : la file est vidée et l'écran recalé sur l'état
 * enregistré. L'état renvoyé par la base n'est appliqué qu'une fois la file vide (jamais d'écrasement d'une
 * modification plus récente).
 */
export class SyncEngine<S, R extends SyncResult<S>> {
  private queue: SyncOp[] = [];
  private running = false;
  private readonly ids = new Map<string, string>();
  private readonly aliases = new Map<string, string>();
  private readonly waiters = new Map<number, (r: R) => void>();
  private idle: (() => void)[] = [];
  private ticket = 0;

  private hooks: Hooks<S, R>;

  constructor(hooks: Hooks<S, R>) {
    this.hooks = hooks;
  }

  setHooks(hooks: Hooks<S, R>) {
    this.hooks = hooks;
  }

  get busy(): boolean {
    return this.running || this.queue.length > 0;
  }

  /** Clé d'affichage stable d'un objet (identifiant provisoire conservé après l'enregistrement). */
  uiKey(id: string): string {
    return this.aliases.get(id) ?? id;
  }

  realId(id: string): string | undefined {
    return this.ids.get(id);
  }

  push(op: SyncOp) {
    this.queue = enqueueOp(this.queue, op);
    void this.drain();
  }

  pushCustom(fields: Record<string, string>): Promise<R> {
    const ticket = ++this.ticket;
    return new Promise((resolve) => {
      this.waiters.set(ticket, resolve);
      this.push({ kind: "custom", fields, ticket });
    });
  }

  /** Attend que tout soit enregistré (avant l'envoi ou la validation). */
  flush(): Promise<void> {
    if (!this.busy) return Promise.resolve();
    void this.drain();
    return new Promise((resolve) => this.idle.push(resolve));
  }

  retry() {
    void this.drain();
  }

  private async drain(): Promise<void> {
    if (this.running || this.queue.length === 0) return;
    this.running = true;
    this.hooks.onStatus("saving");
    const sleep = this.hooks.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
    let latest: S | null = null;
    let refused = false;
    let attempt = 0;
    while (this.queue.length > 0) {
      const op = resolveIds(this.queue[0], this.ids);
      this.queue = this.queue.slice(1);
      let result: R;
      try {
        result = await this.hooks.run(op);
      } catch (error) {
        const superseded = op.kind === "qty" && this.queue.some((q) => q.kind === "qty" && q.itemId === op.itemId);
        if (!superseded) this.queue = [op, ...this.queue];
        if (isNetworkError(error) && attempt < 3) {
          attempt += 1;
          await sleep(attempt * 1500);
          continue;
        }
        this.running = false;
        this.hooks.onStatus("offline");
        return;
      }
      attempt = 0;
      if (result.inventory) latest = result.inventory;
      if (op.kind === "custom") {
        this.waiters.get(op.ticket)?.(result);
        this.waiters.delete(op.ticket);
        continue;
      }
      if (!result.ok) {
        refused = true;
        // Les objets créés hors ligne qui attendaient cette opération ne peuvent plus être enregistrés.
        for (const q of this.queue) if (q.kind === "custom") this.waiters.get(q.ticket)?.(result);
        this.queue = [];
        this.hooks.onRefused(result);
        break;
      }
      if ((op.kind === "add" || op.kind === "room") && result.id) {
        this.ids.set(op.tempId, result.id);
        this.aliases.set(result.id, op.tempId);
      }
    }
    if (!latest && refused) latest = await this.hooks.reload().catch(() => null);
    this.running = false;
    if (this.queue.length > 0) return this.drain();
    if (latest) this.hooks.onSnapshot(latest);
    this.hooks.onStatus("idle");
    this.idle.splice(0).forEach((fn) => fn());
  }
}
