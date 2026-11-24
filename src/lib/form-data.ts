/** Convertit un FormData en objet simple ; les champs vides deviennent `undefined`. */
export function formToObject(formData: FormData): Record<string, string | undefined> {
  const result: Record<string, string | undefined> = {};
  for (const [key, value] of formData.entries()) {
    if (key.startsWith("$ACTION")) continue;
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    result[key] = trimmed === "" ? undefined : trimmed;
  }
  return result;
}

/** Ne garde qu'un chemin interne (« /espace/... ») pour éviter les redirections ouvertes. */
export function safeInternalPath(value: unknown, fallback = "/espace"): string {
  if (typeof value !== "string") return fallback;
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return fallback;
  return value;
}

/** Regroupe les champs « origin.city » en objets imbriqués : { origin: { city } }. */
export function nestDotted(flat: Record<string, string | undefined>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(flat)) {
    const parts = key.split(".");
    let target = result;
    for (const part of parts.slice(0, -1)) {
      if (typeof target[part] !== "object" || target[part] === null) target[part] = {};
      target = target[part] as Record<string, unknown>;
    }
    target[parts[parts.length - 1]] = value;
  }
  return result;
}
