/**
 * Suggestions d'adresses — API Adresse (Base Adresse Nationale), service public
 * gratuit, servi par la Géoplateforme de l'IGN. Appelée directement depuis le
 * navigateur du particulier (CORS autorisé, aucune clé nécessaire).
 */
export const ADDRESS_API_URL = "https://data.geopf.fr/geocodage/search";

export type AddressSuggestion = {
  label: string;
  street: string;
  postalCode: string;
  city: string;
  latitude: number | null;
  longitude: number | null;
};

export function addressSearchUrl(query: string, limit = 5): string {
  const params = new URLSearchParams({ q: query, limit: String(limit), autocomplete: "1", index: "address" });
  return `${ADDRESS_API_URL}?${params.toString()}`;
}

type Feature = {
  geometry?: { coordinates?: [number, number] };
  properties?: { label?: string; name?: string; postcode?: string; city?: string };
};

/** Transforme la réponse GeoJSON de l'API en suggestions exploitables. */
export function parseAddressResponse(json: unknown): AddressSuggestion[] {
  const features = (json as { features?: Feature[] } | null)?.features;
  if (!Array.isArray(features)) return [];
  return features
    .map((f) => {
      const p = f.properties ?? {};
      const [lon, lat] = f.geometry?.coordinates ?? [];
      return {
        label: p.label ?? "",
        street: p.name ?? p.label ?? "",
        postalCode: p.postcode ?? "",
        city: p.city ?? "",
        latitude: typeof lat === "number" ? lat : null,
        longitude: typeof lon === "number" ? lon : null,
      };
    })
    .filter((s) => s.label && s.city);
}

/**
 * Coordonnées d'une adresse saisie sans choisir de suggestion (côté serveur, délai court).
 * Sans réponse fiable, renvoie null : la distance sera alors à confirmer par le déménageur.
 */
export async function geocodeAddress(street: string, postalCode: string, city: string, timeoutMs = 4000): Promise<{ latitude: number; longitude: number } | null> {
  const q = [street, postalCode, city].filter(Boolean).join(" ").trim();
  if (q.length < 3) return null;
  try {
    const params = new URLSearchParams({ q, limit: "1", index: "address" });
    if (/^\d{5}$/.test(postalCode)) params.set("postcode", postalCode);
    const res = await fetch(`${ADDRESS_API_URL}?${params.toString()}`, { signal: AbortSignal.timeout(timeoutMs), cache: "no-store" });
    if (!res.ok) return null;
    const json = (await res.json()) as { features?: (Feature & { properties?: { score?: number } })[] };
    const best = json.features?.[0];
    const [lon, lat] = best?.geometry?.coordinates ?? [];
    if (typeof lat !== "number" || typeof lon !== "number" || (best?.properties?.score ?? 0) < 0.4) return null;
    return { latitude: lat, longitude: lon };
  } catch {
    return null;
  }
}
