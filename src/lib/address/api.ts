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
