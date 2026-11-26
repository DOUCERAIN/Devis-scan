import { test } from "node:test";
import assert from "node:assert/strict";
import { enqueueOp, isNetworkError, isTempId, resolveIds, type SyncOp } from "./sync-queue.ts";

const add = (tempId: string, quantity = 1): SyncOp => ({ kind: "add", tempId, input: { catalog_key: "chaise", category: "cuisine", quantity } });

test("appuis rapides sur « + » : une seule quantité finale enregistrée", () => {
  let q: SyncOp[] = [];
  for (const n of [2, 3, 4, 5]) q = enqueueOp(q, { kind: "qty", itemId: "a", quantity: n });
  assert.deepEqual(q, [{ kind: "qty", itemId: "a", quantity: 5 }]);
});

test("objet ajouté puis modifié avant l'enregistrement : un seul ajout avec la bonne quantité", () => {
  let q = enqueueOp([], add("tmp-1"));
  q = enqueueOp(q, { kind: "qty", itemId: "tmp-1", quantity: 4 });
  assert.equal(q.length, 1);
  assert.equal((q[0] as Extract<SyncOp, { kind: "add" }>).input.quantity, 4);
  assert.deepEqual(enqueueOp(q, { kind: "qty", itemId: "tmp-1", quantity: 0 }), [], "ajouté puis retiré : rien à envoyer");
});

test("l'ordre des autres opérations est conservé ; cartons fusionnés", () => {
  let q = enqueueOp([], { kind: "boxes", boxes: 3 });
  q = enqueueOp(q, add("tmp-2"));
  q = enqueueOp(q, { kind: "boxes", boxes: 12 });
  assert.deepEqual(q.map((o) => o.kind), ["boxes", "add"]);
  assert.equal((q[0] as Extract<SyncOp, { kind: "boxes" }>).boxes, 12);
});

test("identifiants provisoires remplacés par ceux de la base", () => {
  const ids = new Map([["tmp-1", "11111111-1111-1111-1111-111111111111"], ["tmp-room", "22222222-2222-2222-2222-222222222222"]]);
  assert.deepEqual(resolveIds({ kind: "qty", itemId: "tmp-1", quantity: 2 }, ids), { kind: "qty", itemId: ids.get("tmp-1"), quantity: 2 });
  const op = resolveIds({ kind: "add", tempId: "tmp-3", input: { catalog_key: "lit-simple", category: "chambres", room_id: "tmp-room", quantity: 1 } }, ids);
  assert.equal((op as Extract<SyncOp, { kind: "add" }>).input.room_id, ids.get("tmp-room"));
  assert.ok(isTempId("tmp-1") && !isTempId(ids.get("tmp-1")));
});

test("erreurs réseau reconnues", () => {
  assert.ok(isNetworkError(new TypeError("Failed to fetch")));
  assert.ok(isNetworkError(new Error("NetworkError when attempting to fetch resource.")));
  assert.ok(!isNetworkError(new Error("Invalid quantity")));
});

import { SyncEngine } from "./sync-queue.ts";

type Snap = { n: number };
type Res = { ok: boolean; id?: string; message?: string; inventory?: Snap | null };

function engine(run: (op: SyncOp) => Promise<Res>) {
  const log = { statuses: [] as string[], snapshots: [] as Snap[], refused: 0 };
  const e = new SyncEngine<Snap, Res>({
    run, reload: async () => ({ n: -1 }), sleep: async () => {},
    onSnapshot: (s) => log.snapshots.push(s), onStatus: (s) => log.statuses.push(s), onRefused: () => { log.refused += 1; },
  });
  return { e, log };
}

test("moteur : ordre respecté, identifiant provisoire remplacé, état de la base appliqué une fois la file vide", async () => {
  const sent: SyncOp[] = [];
  let n = 0;
  const { e, log } = engine(async (op) => { sent.push(op); n += 1; return { ok: true, id: op.kind === "add" ? "real-1" : undefined, inventory: { n } }; });
  e.push(add("tmp-1"));
  e.push({ kind: "qty", itemId: "tmp-1", quantity: 3 });
  await e.flush();
  assert.deepEqual(sent.map((o) => o.kind), ["add", "qty"]);
  assert.equal((sent[1] as Extract<SyncOp, { kind: "qty" }>).itemId, "real-1");
  assert.deepEqual(log.snapshots, [{ n: 2 }], "un seul recalage, avec le dernier état");
  assert.equal(e.uiKey("real-1"), "tmp-1", "clé d'affichage stable");
  assert.equal(log.statuses.at(-1), "idle");
});

test("moteur : coupure réseau → retentatives puis « hors connexion », rien n'est perdu", async () => {
  let online = false;
  const sent: SyncOp[] = [];
  const { e, log } = engine(async (op) => { if (!online) throw new TypeError("Failed to fetch"); sent.push(op); return { ok: true, inventory: { n: 1 } }; });
  e.push({ kind: "qty", itemId: "a", quantity: 2 });
  await new Promise((r) => setTimeout(r, 10));
  assert.equal(log.statuses.at(-1), "offline");
  assert.ok(e.busy, "modification gardée en attente");
  e.push({ kind: "qty", itemId: "a", quantity: 7 });
  await new Promise((r) => setTimeout(r, 10));
  online = true;
  e.retry();
  await e.flush();
  assert.deepEqual(sent, [{ kind: "qty", itemId: "a", quantity: 7 }], "seule la dernière quantité part");
  assert.equal(log.statuses.at(-1), "idle");
});

test("moteur : refus de la base → file vidée et écran recalé", async () => {
  const { e, log } = engine(async (op) => (op.kind === "boxes" ? { ok: false, message: "Votre inventaire ne peut plus être modifié." } : { ok: true }));
  e.push({ kind: "boxes", boxes: 4 });
  e.push({ kind: "qty", itemId: "b", quantity: 2 });
  await e.flush();
  assert.equal(log.refused, 1);
  assert.deepEqual(log.snapshots, [{ n: -1 }], "état relu en base");
  assert.equal(e.busy, false);
});
