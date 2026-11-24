/**
 * Couleur de marque d'une entreprise (règles de la charte, « Personnalisation par entreprise ») :
 * le texte blanc posé dessus doit rester lisible (contraste ≥ 4,5:1). Sinon la couleur
 * est assombrie automatiquement pour les boutons.
 */

function channel(hex: string, i: number) {
  return parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) / 255;
}

function luminance(hex: string): number {
  const [r, g, b] = [0, 1, 2].map((i) => {
    const c = channel(hex, i);
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastWithWhite(hex: string): number {
  return 1.05 / (luminance(hex) + 0.05);
}

export function isValidHex(value: string | null | undefined): value is string {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value);
}

function toHex(n: number) {
  return Math.round(Math.min(255, Math.max(0, n))).toString(16).padStart(2, "0");
}

function scale(hex: string, factor: number) {
  return `#${[0, 1, 2].map((i) => toHex(channel(hex, i) * 255 * factor)).join("")}`;
}

/** Assombrit la couleur jusqu'à obtenir un contraste suffisant avec le blanc. */
export function accessibleBrandColor(hex: string, minContrast = 4.5): string {
  let color = hex.toLowerCase();
  let factor = 1;
  while (contrastWithWhite(color) < minContrast && factor > 0.05) {
    factor -= 0.05;
    color = scale(hex.toLowerCase(), factor);
  }
  return color;
}

/** Variables CSS de marque blanche à poser sur un conteneur (voir globals.css). */
export function brandCssVariables(hex: string | null | undefined): Record<string, string> | undefined {
  if (!isValidHex(hex)) return undefined;
  const base = accessibleBrandColor(hex);
  return {
    "--ds-brand": base,
    "--ds-brand-hover": scale(base, 0.88),
    "--ds-brand-pressed": scale(base, 0.76),
    "--ds-brand-soft": mixWithWhite(base, 0.92),
    "--ds-brand-soft-strong": mixWithWhite(base, 0.82),
  };
}

function mixWithWhite(hex: string, amount: number) {
  return `#${[0, 1, 2].map((i) => toHex(channel(hex, i) * 255 * (1 - amount) + 255 * amount)).join("")}`;
}
