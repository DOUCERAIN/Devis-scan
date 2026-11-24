/**
 * Choix des images représentatives d'une vidéo (fonctions pures, testées).
 * On échantillonne la vidéo à intervalles réguliers, puis on garde les images
 * les plus nettes en écartant celles qui ressemblent trop à une image déjà retenue.
 */

export type FrameCandidate = {
  /** Instant de l'image, en secondes. */
  time: number;
  /** Netteté (variance du laplacien) : plus c'est élevé, plus l'image est nette. */
  sharpness: number;
  /** Miniature en niveaux de gris (même taille pour toutes les images). */
  signature: Uint8Array;
  /** Luminosité moyenne (0-255), pour écarter les images noires ou surexposées. */
  brightness: number;
};

/** Instants d'échantillonnage répartis sur la vidéo (en évitant tout début et toute fin). */
export function sampleTimestamps(duration: number, count = 24): number[] {
  if (!Number.isFinite(duration) || duration <= 0) return [0];
  if (duration < 1) return [duration / 2];
  const start = Math.min(0.4, duration * 0.05);
  const end = Math.max(start, duration - Math.min(0.4, duration * 0.05));
  const n = Math.max(1, Math.min(count, Math.floor(duration * 4)));
  if (n === 1) return [(start + end) / 2];
  return Array.from({ length: n }, (_, i) => +(start + ((end - start) * i) / (n - 1)).toFixed(3));
}

/** Différence moyenne entre deux miniatures (0 = identiques, 255 = opposées). */
export function signatureDistance(a: Uint8Array, b: Uint8Array): number {
  const n = Math.min(a.length, b.length);
  if (n === 0) return 255;
  let sum = 0;
  for (let i = 0; i < n; i++) sum += Math.abs(a[i] - b[i]);
  return sum / n;
}

/** Variance du laplacien d'une image en niveaux de gris (mesure de netteté). */
export function laplacianVariance(gray: Uint8Array | Uint8ClampedArray, width: number, height: number): number {
  if (width < 3 || height < 3) return 0;
  let sum = 0;
  let sumSq = 0;
  let count = 0;
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x;
      const v = 4 * gray[i] - gray[i - 1] - gray[i + 1] - gray[i - width] - gray[i + width];
      sum += v;
      sumSq += v * v;
      count++;
    }
  }
  const mean = sum / count;
  return sumSq / count - mean * mean;
}

export type SelectionOptions = { max?: number; minDistance?: number; minBrightness?: number; maxBrightness?: number };

/**
 * Sélection : on écarte les images trop sombres ou trop claires et les plus floues
 * (sous 35 % de la netteté médiane), puis on retient par netteté décroissante celles
 * suffisamment différentes des images déjà retenues. Résultat trié dans le temps.
 */
export function selectFrames(candidates: FrameCandidate[], options: SelectionOptions = {}): FrameCandidate[] {
  const { max = 8, minDistance = 10, minBrightness = 18, maxBrightness = 240 } = options;
  const usable = candidates.filter((c) => c.brightness >= minBrightness && c.brightness <= maxBrightness);
  const pool = usable.length > 0 ? usable : candidates;
  if (pool.length === 0) return [];
  const sorted = [...pool].map((c) => c.sharpness).sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  const sharpEnough = pool.filter((c) => c.sharpness >= median * 0.35);

  const chosen: FrameCandidate[] = [];
  for (const c of [...sharpEnough].sort((a, b) => b.sharpness - a.sharpness)) {
    if (chosen.length >= max) break;
    if (chosen.every((k) => signatureDistance(k.signature, c.signature) >= minDistance)) chosen.push(c);
  }
  if (chosen.length === 0) chosen.push([...pool].sort((a, b) => b.sharpness - a.sharpness)[0]);
  return chosen.sort((a, b) => a.time - b.time);
}

/** Dimensions cibles « 720p » : le petit côté ramené à 720 pixels au plus, valeurs paires. */
export function targetDimensions(width: number, height: number, shortSide = 720): { width: number; height: number; scaled: boolean } {
  const small = Math.min(width, height);
  if (small <= shortSide) return { width: width - (width % 2), height: height - (height % 2), scaled: false };
  const ratio = shortSide / small;
  const even = (n: number) => Math.max(2, Math.round(n / 2) * 2);
  return { width: even(width * ratio), height: even(height * ratio), scaled: true };
}
