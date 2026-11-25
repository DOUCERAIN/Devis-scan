import { z } from "zod";

/**
 * Format d'un cas du jeu de données (tests/ai-eval/dataset/<id>/case.json).
 * Un cas = une pièce : les images envoyées au modèle, dans l'ordre, et l'inventaire de référence.
 */
export const ROOM_TYPES = ["salon", "chambre", "cuisine", "salle-de-bain", "garage-cave", "bureau", "entree", "autre"] as const;
export const SITUATIONS = ["encombre", "partiellement-visible", "multi-angles", "objets-ambigus", "faible-luminosite"] as const;
export const SOURCE_KINDS = ["photo-panoramique", "photos-reelles", "video-reelle"] as const;

export const ROOM_TYPE_LABELS: Record<(typeof ROOM_TYPES)[number], string> = {
  salon: "Salon",
  chambre: "Chambre",
  cuisine: "Cuisine",
  "salle-de-bain": "Salle de bain",
  "garage-cave": "Garage / cave",
  bureau: "Bureau",
  entree: "Entrée",
  autre: "Autre",
};

export const SITUATION_LABELS: Record<(typeof SITUATIONS)[number], string> = {
  encombre: "Pièce encombrée",
  "partiellement-visible": "Mobilier partiellement visible",
  "multi-angles": "Plusieurs angles d'un même meuble",
  "objets-ambigus": "Objets difficiles ou ambigus",
  "faible-luminosite": "Faible luminosité",
};

/** Plafond d'images par cas (la production en envoie jusqu'à 8 par vidéo). Au-delà de 20, l'API impose d'autres limites. */
export const MAX_FRAMES_PER_CASE = 20;

const referenceItemSchema = z.object({
  /** Identifiant du catalogue (public.furniture_catalog / data/catalog/catalog.json). */
  key: z.string().min(1),
  quantity: z.number().int().min(1).max(200),
  /** Autres identifiants acceptés (ex. bibliothèque / étagère). */
  alternatives: z.array(z.string().min(1)).default([]),
  /** Objet ambigu ou minime : ni oubli s'il manque, ni erreur s'il est trouvé. */
  optional: z.boolean().default(false),
  /** Meuble partiellement caché ou coupé sur toutes les images. */
  partial: z.boolean().default(false),
  /** Objet difficile à reconnaître (nature, taille ou nombre ambigus). */
  difficult: z.boolean().default(false),
  /** Volume mesuré par une personne (m³), prioritaire sur le volume moyen du catalogue. */
  volume_m3: z.number().positive().max(100).nullable().default(null),
  /** Images où l'objet apparaît (information, sert à repérer les vues multiples). */
  views: z.array(z.string()).default([]),
  comment: z.string().default(""),
});

export const caseSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/, "identifiant : minuscules, chiffres et tirets"),
  /** Nom de la pièce tel qu'un client le saisirait (envoyé au modèle). */
  room_label: z.string().min(1).max(80),
  room_description: z.string().max(300).nullable().default(null),
  room_type: z.enum(ROOM_TYPES),
  situations: z.array(z.enum(SITUATIONS)).default([]),
  source: z.object({
    kind: z.enum(SOURCE_KINDS),
    description: z.string().min(1),
    author: z.string().min(1),
    license: z.string().min(1),
    url: z.string().nullable().default(null),
    /** Pour une vidéo filmée chez quelqu'un : accord écrit des occupants. Jamais d'images de clients. */
    consent: z.string().nullable().default(null),
  }),
  frames: z.array(z.object({ file: z.string().regex(/^[\w.-]+\.(jpe?g|png)$/i), captured_at_ms: z.number().nullable().default(null) })).min(1).max(MAX_FRAMES_PER_CASE),
  reference: z.object({
    status: z.enum(["provisoire", "validee"]),
    annotated_by: z.string().min(1),
    annotated_at: z.string().min(1),
    validated_by: z.string().nullable().default(null),
    validated_at: z.string().nullable().default(null),
    notes: z.string().default(""),
    items: z.array(referenceItemSchema).min(1),
  }),
});

export type BenchmarkCase = z.infer<typeof caseSchema>;
export type CaseReferenceItem = BenchmarkCase["reference"]["items"][number];
export type FrameInfo = { file: string; width: number; height: number; mediaType: "image/jpeg" | "image/png" };

/**
 * Contrôles de cohérence d'un cas : identifiants du catalogue, images présentes et lisibles,
 * référence validée signée et datée. Renvoie la liste des problèmes (vide si tout va bien).
 */
export function validateCase(c: BenchmarkCase, ctx: { catalogIds: Set<string>; frames: Map<string, FrameInfo | null> }): string[] {
  const problems: string[] = [];
  const seenFiles = new Set<string>();
  for (const f of c.frames) {
    if (seenFiles.has(f.file)) problems.push(`image en double dans la liste : ${f.file}`);
    seenFiles.add(f.file);
    if (!ctx.frames.get(f.file)) problems.push(`image absente ou illisible : ${f.file}`);
  }
  for (const item of c.reference.items) {
    for (const k of [item.key, ...item.alternatives]) if (!ctx.catalogIds.has(k)) problems.push(`identifiant absent du catalogue : ${k}`);
    for (const v of item.views) if (!seenFiles.has(v)) problems.push(`vue inconnue pour ${item.key} : ${v}`);
  }
  const keys = c.reference.items.map((i) => i.key);
  for (const k of new Set(keys)) if (keys.filter((x) => x === k).length > 1 && c.reference.items.filter((i) => i.key === k).some((i) => i.optional)) {
    problems.push(`${k} : une même référence ne peut pas être à la fois obligatoire et facultative (fusionner les lignes)`);
  }
  if (c.reference.status === "validee" && (!c.reference.validated_by || !c.reference.validated_at)) {
    problems.push("référence « validee » sans nom ni date de validation");
  }
  if (c.situations.includes("partiellement-visible") && !c.reference.items.some((i) => i.partial)) {
    problems.push("situation « partiellement-visible » sans aucun objet marqué partial");
  }
  if (c.situations.includes("objets-ambigus") && !c.reference.items.some((i) => i.difficult)) {
    problems.push("situation « objets-ambigus » sans aucun objet marqué difficult");
  }
  return problems;
}

/** Dimensions d'une image JPEG ou PNG lues dans son en-tête (sans dépendance). null si format non reconnu. */
export function readImageInfo(file: string, data: Uint8Array): FrameInfo | null {
  // PNG : signature puis bloc IHDR (largeur, hauteur sur 4 octets).
  if (data.length > 24 && data[0] === 0x89 && data[1] === 0x50 && data[2] === 0x4e && data[3] === 0x47) {
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    return { file, width: view.getUint32(16), height: view.getUint32(20), mediaType: "image/png" };
  }
  // JPEG : parcours des segments jusqu'à un marqueur SOF (C0–CF sauf C4, C8, CC).
  if (data.length < 4 || data[0] !== 0xff || data[1] !== 0xd8) return null;
  let i = 2;
  while (i + 9 < data.length) {
    if (data[i] !== 0xff) return null;
    const marker = data[i + 1];
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      i += 2;
      continue;
    }
    const length = (data[i + 2] << 8) | data[i + 3];
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      const height = (data[i + 5] << 8) | data[i + 6];
      const width = (data[i + 7] << 8) | data[i + 8];
      return width > 0 && height > 0 ? { file, width, height, mediaType: "image/jpeg" } : null;
    }
    i += 2 + length;
  }
  return null;
}

/**
 * Couverture minimale d'un benchmark représentatif (protocole, tests/ai-eval/PROTOCOLE.md).
 * Un même cas peut couvrir un type de pièce et plusieurs situations.
 */
export const MIN_REPRESENTATIVE_CASES = 12;
export const COVERAGE_TARGETS = {
  roomTypes: { salon: 2, chambre: 2, cuisine: 2, "salle-de-bain": 1, "garage-cave": 2 } as Partial<Record<(typeof ROOM_TYPES)[number], number>>,
  situations: { encombre: 3, "partiellement-visible": 4, "multi-angles": 3, "objets-ambigus": 2 } as Partial<Record<(typeof SITUATIONS)[number], number>>,
};

export type CoverageLine = { kind: "piece" | "situation" | "total"; key: string; label: string; have: number; target: number; ok: boolean };

/** Couverture du jeu de données. Seules les références validées par une personne comptent pour « validee ». */
export function coverage(cases: Pick<BenchmarkCase, "room_type" | "situations" | "source" | "reference">[]): { lines: CoverageLine[]; representative: boolean } {
  const lines: CoverageLine[] = [];
  for (const [key, target] of Object.entries(COVERAGE_TARGETS.roomTypes)) {
    const have = cases.filter((c) => c.room_type === key).length;
    lines.push({ kind: "piece", key, label: ROOM_TYPE_LABELS[key as (typeof ROOM_TYPES)[number]], have, target: target ?? 0, ok: have >= (target ?? 0) });
  }
  for (const [key, target] of Object.entries(COVERAGE_TARGETS.situations)) {
    // « multi-angles » n'est réel qu'avec une vraie vidéo ou plusieurs photos (pas un panoramique sur une photo).
    const have = cases.filter((c) => c.situations.includes(key as (typeof SITUATIONS)[number]) && (key !== "multi-angles" || c.source.kind !== "photo-panoramique")).length;
    lines.push({ kind: "situation", key, label: SITUATION_LABELS[key as (typeof SITUATIONS)[number]], have, target: target ?? 0, ok: have >= (target ?? 0) });
  }
  lines.push({ kind: "total", key: "cas", label: "Cas (pièces) au total", have: cases.length, target: MIN_REPRESENTATIVE_CASES, ok: cases.length >= MIN_REPRESENTATIVE_CASES });
  const validated = cases.filter((c) => c.reference.status === "validee").length;
  lines.push({ kind: "total", key: "validees", label: "Références validées par une personne", have: validated, target: cases.length, ok: cases.length > 0 && validated === cases.length });
  return { lines, representative: lines.every((l) => l.ok) };
}
