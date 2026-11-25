"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { Minus, PackagePlus, Plus, Search, Trash2, X } from "lucide-react";
import { addCatalogItem, addCustomItem, changeQuantity, type InventoryResult } from "@/app/d/[slug]/inventory-actions";
import { catalogForCategory, categoryLabel, MANUAL_CATEGORIES, searchCatalog, SIZE_CLASSES, manualCategoryFor, type CatalogChoice, type ManualCategory } from "@/lib/inventory/manual";
import type { PublicInventoryItem } from "@/lib/public-request/service";
import { Button } from "@/components/ui/Button";
import { TextArea, TextField } from "@/components/ui/Field";
import { cn } from "@/components/ui/cn";

const m3 = (n: number) => `${n.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} m³`;

const VOLUME_NOTE: Record<string, string> = {
  comparable: "volume d'un objet de taille comparable",
  dimensions: "volume calculé avec vos dimensions",
};

/**
 * Saisie de l'inventaire par le client : catégories, recherche dans le catalogue, quantités, objets
 * personnalisés. Chaque modification est enregistrée immédiatement en base (rien n'est perdu si la page
 * est fermée). `viewToken` : lien de suivi (inventaire de l'analyse à corriger) ; sinon, brouillon du cookie.
 */
export function InventoryBuilder({ slug, viewToken = null, catalog, items }: { slug: string; viewToken?: string | null; catalog: CatalogChoice[]; items: PublicInventoryItem[] }) {
  const [category, setCategory] = useState<ManualCategory>("salon");
  const [query, setQuery] = useState("");
  const [sizeFor, setSizeFor] = useState<string | null>(null);
  const [custom, setCustom] = useState(false);
  const [feedback, setFeedback] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const results = useMemo(() => (query.trim() ? searchCatalog(catalog, query, 25) : catalogForCategory(catalog, category)), [catalog, category, query]);
  // Quantité déjà saisie pour un objet du catalogue, dans sa catégorie (objets ajoutés par le client).
  const added = useMemo(() => {
    const map = new Map<string, PublicInventoryItem>();
    for (const i of items) if (i.catalog_key && i.source === "customer" && !map.has(`${i.category}:${i.catalog_key}`)) map.set(`${i.category}:${i.catalog_key}`, i);
    return map;
  }, [items]);
  const total = items.reduce((s, i) => s + i.quantity * Number(i.unit_volume_m3), 0);
  const count = items.reduce((s, i) => s + i.quantity, 0);
  const rooms = useMemo(() => {
    const map = new Map<string, PublicInventoryItem[]>();
    for (const i of items) map.set(i.room, [...(map.get(i.room) ?? []), i]);
    return [...map.entries()];
  }, [items]);

  function run(key: string, task: () => Promise<InventoryResult>, onOk?: () => void) {
    setBusyKey(key);
    startTransition(async () => {
      const result = await task();
      setBusyKey(null);
      if (result.ok) {
        setFeedback(result.message ? { tone: "ok", text: result.message } : null);
        onOk?.();
      } else setFeedback({ tone: "error", text: result.message });
    });
  }

  function increment(c: CatalogChoice, size?: string) {
    const cat = query.trim() ? manualCategoryFor(c.category) : category;
    const existing = added.get(`${cat}:${c.id}`);
    if (existing) return run(c.id, () => changeQuantity(slug, viewToken, existing.id, existing.quantity + 1));
    if (c.volume === null && !size) return setSizeFor(c.id);
    run(c.id, () => addCatalogItem(slug, viewToken, { catalog_key: c.id, category: cat, size }), () => setSizeFor(null));
  }

  function decrement(c: CatalogChoice) {
    const cat = query.trim() ? manualCategoryFor(c.category) : category;
    const existing = added.get(`${cat}:${c.id}`);
    if (existing) run(c.id, () => changeQuantity(slug, viewToken, existing.id, existing.quantity - 1));
  }

  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="add-title" className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-4 sm:p-6">
        <h2 id="add-title" className="text-lg leading-[26px] font-semibold">Ajouter des meubles et objets</h2>
        <label className="relative block">
          <span className="sr-only">Rechercher un meuble</span>
          <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-muted" />
          <input type="search" value={query} onChange={(e) => setQuery(e.currentTarget.value)} placeholder="Rechercher : canapé, frigo, vélo…"
            className="h-12 w-full rounded-md border border-border-input bg-surface pr-3 pl-9 text-base focus:border-brand focus:shadow-[0_0_0_3px_var(--ds-brand-soft-strong)] focus:outline-none sm:h-10 sm:text-[15px]" />
        </label>

        {!query.trim() ? (
          <div role="tablist" aria-label="Catégories" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            {MANUAL_CATEGORIES.map((c) => (
              <button key={c.key} type="button" role="tab" aria-selected={category === c.key} onClick={() => { setCategory(c.key); setSizeFor(null); }}
                className={cn("min-h-10 shrink-0 rounded-full border px-4 text-sm font-medium",
                  category === c.key ? "border-brand bg-brand-soft text-brand-pressed" : "border-border-input bg-surface text-ink hover:bg-surface-subtle")}>
                {c.label}
              </button>
            ))}
          </div>
        ) : (
          <p className="text-sm text-ink-secondary">{results.length} résultat{results.length > 1 ? "s" : ""} pour « {query.trim()} »</p>
        )}

        <ul className="-mx-1 flex max-h-[26rem] flex-col divide-y divide-border overflow-y-auto overscroll-contain px-1" aria-label={query.trim() ? "Résultats de la recherche" : `Objets : ${categoryLabel(category)}`}>
          {results.map((c) => {
            const cat = query.trim() ? manualCategoryFor(c.category) : category;
            const qty = added.get(`${cat}:${c.id}`)?.quantity ?? 0;
            return (
              <li key={c.id} className="flex flex-col gap-2 py-2.5" data-testid="catalog-item">
                <div className="flex items-center justify-between gap-3">
                  <span className="min-w-0">
                    <span className="block font-medium">{c.name}</span>
                    {query.trim() ? <span className="text-xs text-ink-muted">{categoryLabel(cat)}</span> : null}
                  </span>
                  <span className="flex shrink-0 items-center gap-1">
                    {qty > 0 ? (
                      <>
                        <button type="button" onClick={() => decrement(c)} disabled={pending} aria-label={`Retirer un ${c.name}`}
                          className="inline-flex size-11 items-center justify-center rounded-md border border-border-input hover:bg-surface-subtle disabled:opacity-50 sm:size-9">
                          <Minus aria-hidden className="size-4" />
                        </button>
                        <span className="w-8 text-center font-semibold tabular-nums" aria-live="polite">{qty}</span>
                      </>
                    ) : null}
                    <button type="button" onClick={() => increment(c)} disabled={pending} aria-label={`Ajouter un ${c.name}`}
                      className="inline-flex size-11 items-center justify-center rounded-md border border-brand bg-brand-soft text-brand-pressed hover:bg-brand-soft-strong disabled:opacity-50 sm:size-9">
                      <Plus aria-hidden className="size-4" />
                    </button>
                  </span>
                </div>
                {sizeFor === c.id ? (
                  <div className="flex flex-col gap-2 rounded-md bg-surface-subtle p-3">
                    <p className="text-sm">Quelle est sa taille, environ ? <span className="text-ink-secondary">(nous n&apos;avons pas de volume de référence pour cet objet)</span></p>
                    <div className="grid grid-cols-2 gap-2">
                      {SIZE_CLASSES.map((s) => (
                        <button key={s.value} type="button" onClick={() => increment(c, s.value)} disabled={pending}
                          className="flex min-h-12 flex-col items-start justify-center rounded-md border border-border-input bg-surface px-3 py-1.5 text-left text-sm font-medium hover:border-brand">
                          {s.label}<span className="text-xs font-normal text-ink-muted">{s.hint}</span>
                        </button>
                      ))}
                    </div>
                    <button type="button" onClick={() => setSizeFor(null)} className="self-start text-sm text-ink-secondary underline">Annuler</button>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
        {results.length === 0 ? <p className="text-sm text-ink-secondary">Aucun objet ne correspond. Ajoutez-le comme objet personnalisé ci-dessous.</p> : null}

        {custom ? (
          <CustomItemForm slug={slug} viewToken={viewToken} category={query.trim() ? "autres" : category} initialLabel={query.trim()}
            onDone={(text) => { setCustom(false); setQuery(""); setFeedback({ tone: "ok", text }); }} onCancel={() => setCustom(false)} />
        ) : (
          <p className="text-sm">
            Vous ne trouvez pas votre meuble ?{" "}
            <button type="button" onClick={() => setCustom(true)} className="inline-flex min-h-11 items-center gap-1 font-semibold text-brand hover:underline">
              <PackagePlus aria-hidden className="size-4" /> Ajouter un objet personnalisé.
            </button>
          </p>
        )}
        <p role="status" aria-live="polite" className={cn("min-h-5 text-sm", feedback?.tone === "error" ? "text-danger-text" : "text-success-text")}>{feedback?.text}</p>
      </section>

      <section aria-labelledby="list-title" className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="list-title" className="text-[20px] leading-[28px] font-bold">Votre inventaire</h2>
          <p className="text-sm text-ink-secondary" data-testid="inventory-total">
            {count} objet{count > 1 ? "s" : ""} · <strong className="text-ink">{m3(Math.round(total * 100) / 100)}</strong>
          </p>
        </div>
        {rooms.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border-input p-4 text-sm text-ink-secondary">Votre inventaire est vide. Ajoutez vos meubles et cartons ci-dessus.</p>
        ) : (
          rooms.map(([room, list]) => (
            <div key={room} className="rounded-lg border border-border bg-surface p-4">
              <h3 className="font-semibold">{room}</h3>
              <ul className="mt-1 divide-y divide-border">
                {list.map((i) => (
                  <ItemRow key={i.id} item={i} busy={pending && busyKey === i.id}
                    onQuantity={(q) => run(i.id, () => changeQuantity(slug, viewToken, i.id, q))} />
                ))}
              </ul>
            </div>
          ))
        )}
      </section>
    </div>
  );
}

function ItemRow({ item, busy, onQuantity }: { item: PublicInventoryItem; busy: boolean; onQuantity: (q: number) => void }) {
  const note = item.volume_source ? VOLUME_NOTE[item.volume_source] : undefined;
  return (
    <li className="flex flex-col gap-1 py-2" data-testid="inventory-item">
      <div className="flex items-center justify-between gap-3">
        <span className="min-w-0">
          <span className="block">{item.name}</span>
          <span className="text-xs text-ink-muted">
            {m3(Number(item.unit_volume_m3))} l&apos;unité{note ? ` · ${note}` : ""}{item.source === "customer" && item.catalog_key === null ? " · objet personnalisé" : ""}
          </span>
          {item.comment ? <span className="block text-xs text-ink-secondary">« {item.comment} »</span> : null}
        </span>
        <span className="flex shrink-0 items-center gap-1">
          <button type="button" onClick={() => onQuantity(item.quantity - 1)} disabled={busy || item.quantity <= 1} aria-label={`Diminuer la quantité : ${item.name}`}
            className="inline-flex size-11 items-center justify-center rounded-md border border-border-input hover:bg-surface-subtle disabled:opacity-40 sm:size-9">
            <Minus aria-hidden className="size-4" />
          </button>
          <span className="w-8 text-center font-semibold tabular-nums">{item.quantity}</span>
          <button type="button" onClick={() => onQuantity(item.quantity + 1)} disabled={busy || item.quantity >= 999} aria-label={`Augmenter la quantité : ${item.name}`}
            className="inline-flex size-11 items-center justify-center rounded-md border border-border-input hover:bg-surface-subtle disabled:opacity-40 sm:size-9">
            <Plus aria-hidden className="size-4" />
          </button>
          <button type="button" onClick={() => onQuantity(0)} disabled={busy} aria-label={`Retirer : ${item.name}`}
            className="ml-1 inline-flex size-11 items-center justify-center rounded-md text-danger-text hover:bg-danger-soft disabled:opacity-40 sm:size-9">
            <Trash2 aria-hidden className="size-4" />
          </button>
        </span>
      </div>
    </li>
  );
}

function CustomItemForm({ slug, viewToken, category, initialLabel, onDone, onCancel }: {
  slug: string; viewToken: string | null; category: ManualCategory; initialLabel: string; onDone: (message: string) => void; onCancel: () => void;
}) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const form = useRef<HTMLFormElement>(null);
  const [cat, setCat] = useState<ManualCategory>(category);

  return (
    <form ref={form} className="flex flex-col gap-4 rounded-md border border-brand/40 bg-brand-soft/40 p-4" noValidate data-testid="custom-item-form"
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        startTransition(async () => {
          const result = await addCustomItem(slug, viewToken, data);
          if (result.ok) onDone(result.message ?? "Objet ajouté.");
          else { setErrors(result.fieldErrors ?? {}); setMessage(result.message); }
        });
      }}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-semibold">Objet personnalisé</h3>
        <button type="button" onClick={onCancel} aria-label="Fermer" className="inline-flex size-10 items-center justify-center rounded-md hover:bg-surface"><X aria-hidden className="size-4" /></button>
      </div>
      <TextField id="custom-label" name="label" label="Description" defaultValue={initialLabel} placeholder="Ex. : aquarium 200 L, statue, coffre-fort…" error={errors.label} />
      <div className="grid grid-cols-2 gap-4">
        <TextField id="custom-quantity" name="quantity" label="Quantité" inputMode="numeric" defaultValue="1" error={errors.quantity} />
        <label className="flex min-w-0 flex-col gap-1.5 text-sm font-medium">
          Pièce
          <select name="category" value={cat} onChange={(e) => setCat(e.currentTarget.value as ManualCategory)}
            className="h-12 rounded-md border border-border-input bg-surface px-3 text-base sm:h-10 sm:text-[15px]">
            {MANUAL_CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
          </select>
        </label>
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
        <p className="mt-2 text-xs text-ink-muted">Avec les dimensions, le volume est calculé à partir de celles-ci plutôt que de la taille approximative.</p>
      </details>
      <TextArea id="custom-comment" name="comment" label="Commentaire" optional rows={2} placeholder="Fragile, démontable, très lourd…" error={errors.comment} />
      {message ? <p className="text-sm text-danger-text">{message}</p> : null}
      <Button type="submit" disabled={pending}>{pending ? "Ajout…" : "Ajouter cet objet"}</Button>
    </form>
  );
}
