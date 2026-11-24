"use client";

import { useEffect, useId, useRef, useState } from "react";
import { MapPin } from "lucide-react";
import { addressSearchUrl, parseAddressResponse, type AddressSuggestion } from "@/lib/address/api";
import { cn } from "@/components/ui/cn";

type Values = { address_line?: string | null; postal_code?: string | null; city?: string | null; latitude?: string | number | null; longitude?: string | number | null };
type Errors = Partial<Record<"address_line" | "postal_code" | "city", string>>;

/**
 * Adresse avec suggestions de l'API Adresse (data.gouv.fr / IGN).
 * Choisir une suggestion remplit le code postal, la ville et les coordonnées.
 * Si le service est indisponible, la saisie manuelle reste possible.
 */
export function AddressField({ prefix, label, values, errors }: { prefix: string; label: string; values: Values; errors: Errors }) {
  const uid = useId();
  const [street, setStreet] = useState(values.address_line ?? "");
  const [postal, setPostal] = useState(values.postal_code ?? "");
  const [city, setCity] = useState(values.city ?? "");
  const [coords, setCoords] = useState({ lat: String(values.latitude ?? ""), lon: String(values.longitude ?? "") });
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [unavailable, setUnavailable] = useState(false);
  const [query, setQuery] = useState("");
  const abort = useRef<AbortController | null>(null);

  useEffect(() => {
    if (query.trim().length < 3) return;
    const timer = setTimeout(async () => {
      abort.current?.abort();
      const controller = new AbortController();
      abort.current = controller;
      try {
        const res = await fetch(addressSearchUrl(query), { signal: controller.signal });
        if (!res.ok) throw new Error(String(res.status));
        const list = parseAddressResponse(await res.json());
        setSuggestions(list);
        setOpen(list.length > 0);
        setActive(-1);
        setUnavailable(false);
      } catch (e) {
        if ((e as Error).name !== "AbortError") setUnavailable(true);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  function choose(s: AddressSuggestion) {
    setStreet(s.street);
    setPostal(s.postalCode);
    setCity(s.city);
    setCoords({ lat: s.latitude === null ? "" : String(s.latitude), lon: s.longitude === null ? "" : String(s.longitude) });
    setOpen(false);
    setSuggestions([]);
  }

  const listId = `${uid}-list`;
  const inputClass = "h-12 w-full rounded-md border bg-surface px-3 text-base text-ink placeholder:text-ink-muted focus:border-brand focus:shadow-[0_0_0_3px_var(--ds-brand-soft-strong)] focus:outline-none";

  return (
    <div className="flex flex-col gap-3">
      <div className="relative flex flex-col gap-1.5">
        <label htmlFor={`${uid}-street`} className="text-sm leading-5 font-medium text-ink">{label}</label>
        <input
          id={`${uid}-street`}
          name={`${prefix}.address_line`}
          value={street}
          autoComplete="off"
          placeholder="N° et rue, ex. : 8 boulevard du Port"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
          aria-invalid={errors.address_line ? true : undefined}
          onChange={(e) => {
            setStreet(e.target.value);
            setQuery(e.target.value);
            setCoords({ lat: "", lon: "" });
            if (e.target.value.trim().length < 3) setOpen(false);
          }}
          onKeyDown={(e) => {
            if (!open) return;
            if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, suggestions.length - 1)); }
            else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
            else if (e.key === "Enter" && active >= 0) { e.preventDefault(); choose(suggestions[active]); }
            else if (e.key === "Escape") setOpen(false);
          }}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          className={cn(inputClass, errors.address_line ? "border-danger" : "border-border-input")}
        />
        {open && (
          <ul id={listId} role="listbox" className="absolute top-full z-20 mt-1 w-full overflow-hidden rounded-md border border-border bg-surface shadow-md">
            {suggestions.map((s, i) => (
              <li
                key={`${s.label}-${i}`}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === active}
                onMouseDown={(e) => { e.preventDefault(); choose(s); }}
                className={cn("flex min-h-12 cursor-pointer items-center gap-2 px-3 py-2 text-sm", i === active ? "bg-brand-soft" : "hover:bg-canvas")}
              >
                <MapPin aria-hidden className="size-4 shrink-0 text-ink-muted" />
                <span>{s.label}</span>
              </li>
            ))}
          </ul>
        )}
        {errors.address_line ? (
          <p className="text-xs leading-4 text-danger-text">{errors.address_line}</p>
        ) : unavailable ? (
          <p className="text-xs leading-4 text-ink-muted">Suggestions indisponibles pour le moment : complétez le code postal et la ville.</p>
        ) : (
          <p className="text-xs leading-4 text-ink-muted">Commencez à taper puis choisissez l&apos;adresse proposée.</p>
        )}
      </div>
      <div className="grid grid-cols-[120px_1fr] gap-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${uid}-postal`} className="text-sm leading-5 font-medium text-ink">Code postal</label>
          <input id={`${uid}-postal`} name={`${prefix}.postal_code`} value={postal} inputMode="numeric" autoComplete="off"
            onChange={(e) => setPostal(e.target.value)} aria-invalid={errors.postal_code ? true : undefined}
            className={cn(inputClass, errors.postal_code ? "border-danger" : "border-border-input")} />
          {errors.postal_code && <p className="text-xs leading-4 text-danger-text">{errors.postal_code}</p>}
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${uid}-city`} className="text-sm leading-5 font-medium text-ink">Ville</label>
          <input id={`${uid}-city`} name={`${prefix}.city`} value={city} autoComplete="off"
            onChange={(e) => setCity(e.target.value)} aria-invalid={errors.city ? true : undefined}
            className={cn(inputClass, errors.city ? "border-danger" : "border-border-input")} />
          {errors.city && <p className="text-xs leading-4 text-danger-text">{errors.city}</p>}
        </div>
      </div>
      <input type="hidden" name={`${prefix}.latitude`} value={coords.lat} />
      <input type="hidden" name={`${prefix}.longitude`} value={coords.lon} />
    </div>
  );
}
