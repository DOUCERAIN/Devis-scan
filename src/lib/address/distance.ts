/**
 * Distance entre deux adresses.
 * 1. Itinéraire routier : service de calcul d'itinéraire de la Géoplateforme (IGN), gratuit, sans clé.
 * 2. À défaut : distance à vol d'oiseau × 1,3 (facteur de détour usuel, hypothèse à calibrer),
 *    signalée comme « estimée » sur le devis.
 */
export type Point = { latitude: number; longitude: number };
export type DistanceResult = { km: number; method: "route" | "estimate" };

export const DETOUR_FACTOR = 1.3;
const ROUTE_URL = "https://data.geopf.fr/navigation/itineraire";

export function haversineKm(a: Point, b: Point): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.latitude - a.latitude);
  const dLon = rad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

export function estimateKm(a: Point, b: Point): number {
  return Math.round(haversineKm(a, b) * DETOUR_FACTOR * 10) / 10;
}

export async function routeKm(a: Point, b: Point, fetchImpl: typeof fetch = fetch): Promise<number | null> {
  const params = new URLSearchParams({
    resource: "bdtopo-osrm",
    profile: "car",
    optimization: "fastest",
    start: `${a.longitude},${a.latitude}`,
    end: `${b.longitude},${b.latitude}`,
    distanceUnit: "kilometer",
    geometryFormat: "geojson",
    getSteps: "false",
  });
  try {
    const response = await fetchImpl(`${ROUTE_URL}?${params}`, { signal: AbortSignal.timeout(8000) });
    if (!response.ok) return null;
    const data = (await response.json()) as { distance?: unknown };
    const km = typeof data.distance === "number" ? data.distance : Number(data.distance);
    return Number.isFinite(km) && km >= 0 && km < 5000 ? Math.round(km * 10) / 10 : null;
  } catch {
    return null;
  }
}

export async function distanceBetween(a: Point | null, b: Point | null, fetchImpl: typeof fetch = fetch): Promise<DistanceResult | null> {
  if (!a || !b) return null;
  const route = await routeKm(a, b, fetchImpl);
  if (route !== null) return { km: route, method: "route" };
  return { km: estimateKm(a, b), method: "estimate" };
}
