import type { ItemDraft } from "../postprocess.ts";
import type { CaseReferenceItem } from "./dataset.ts";

/**
 * Notation OBJECTIVE d'une analyse par rapport à l'inventaire de référence vérifié par une personne.
 * Toutes les règles sont déterministes et documentées dans tests/ai-eval/PROTOCOLE.md.
 *
 * Vocabulaire :
 * - correct : objet de référence retrouvé (à la quantité près, identifiant exact ou alternative acceptée) ;
 * - oublié : objet de référence non retrouvé ;
 * - en trop (doublon) : objet bien identifié mais compté plus de fois qu'il n'existe (même meuble vu sous plusieurs angles) ;
 * - inventé ou mal identifié : objet compté qui n'existe pas dans la référence ;
 * - doublon possible : objet que le post-traitement a mis de côté (non compté), comme en production.
 */

export type CatalogInfo = { subcategory: string; movingVolumeAvg: number | null };
export type Detected = Pick<ItemDraft, "catalogKey" | "name" | "quantity" | "possibleDuplicate" | "unitVolumeM3" | "volumeSource">;

export type CaseScore = {
  caseId: string;
  analysed: boolean;
  referenceTotal: number;
  detectedTotal: number;
  correct: number;
  missed: { key: string; quantity: number }[];
  overcounted: { key: string; quantity: number }[];
  invented: { key: string; quantity: number }[];
  category: { referenceTotal: number; detectedTotal: number; correct: number };
  partial: { total: number; found: number };
  difficult: { total: number; found: number };
  duplicates: { flagged: number; justified: number; hidingRealObject: number };
  volume: { countedM3: number; referenceMinM3: number; referenceMaxM3: number; errorM3: number; unknownReferenceVolumes: number };
  outsideCatalog: number;
};

const r3 = (n: number) => Math.round(n * 1000) / 1000;

/** Volume de référence d'une ligne : mesuré par une personne, sinon volume moyen du catalogue, sinon inconnu. */
function referenceVolume(item: CaseReferenceItem, catalog: Map<string, CatalogInfo>): number | null {
  return item.volume_m3 ?? catalog.get(item.key)?.movingVolumeAvg ?? null;
}

/**
 * Répartit les objets retrouvés d'une référence entre ses lignes : d'abord les lignes non marquées
 * (objets faciles), puis les lignes marquées. Règle prudente : un meuble caché n'est compté comme
 * retrouvé que si tous les meubles visibles de même type l'ont été.
 */
function flaggedFound(items: CaseReferenceItem[], matchedByKey: Map<string, number>, flag: "partial" | "difficult") {
  let total = 0;
  let found = 0;
  const byKey = new Map<string, CaseReferenceItem[]>();
  for (const i of items) if (!i.optional) byKey.set(i.key, [...(byKey.get(i.key) ?? []), i]);
  for (const [key, lines] of byKey) {
    let left = matchedByKey.get(key) ?? 0;
    for (const line of [...lines].sort((a, b) => Number(a[flag]) - Number(b[flag]))) {
      const got = Math.min(left, line.quantity);
      left -= got;
      if (line[flag]) {
        total += line.quantity;
        found += got;
      }
    }
  }
  return { total, found };
}

export function scoreCase(caseId: string, detected: Detected[] | null, reference: CaseReferenceItem[], catalog: Map<string, CatalogInfo>): CaseScore {
  const required = new Map<string, number>();
  const optionalLeft = new Map<string, number>();
  const alias = new Map<string, string>();
  for (const r of reference) {
    if (r.optional) optionalLeft.set(r.key, (optionalLeft.get(r.key) ?? 0) + r.quantity);
    else required.set(r.key, (required.get(r.key) ?? 0) + r.quantity);
    for (const alt of r.alternatives) if (alt !== r.key) alias.set(alt, r.key);
  }

  const got = new Map<string, number>();
  const flaggedKeys: string[] = [];
  let countedM3 = 0;
  let outsideCatalog = 0;
  for (const d of detected ?? []) {
    const raw = d.catalogKey ?? `autre:${d.name}`;
    const k = alias.get(raw) ?? raw;
    if (d.possibleDuplicate) {
      flaggedKeys.push(k);
      continue;
    }
    countedM3 += d.quantity * d.unitVolumeM3;
    if (d.catalogKey === null) outsideCatalog += d.quantity;
    let quantity = d.quantity;
    const opt = optionalLeft.get(k) ?? 0;
    if (opt > 0 && !required.has(k)) {
      const used = Math.min(opt, quantity);
      optionalLeft.set(k, opt - used);
      quantity -= used;
    }
    if (quantity > 0) got.set(k, (got.get(k) ?? 0) + quantity);
  }

  const matchedByKey = new Map<string, number>();
  const missed: CaseScore["missed"] = [];
  const overcounted: CaseScore["overcounted"] = [];
  const invented: CaseScore["invented"] = [];
  for (const [key, q] of required) {
    const g = got.get(key) ?? 0;
    matchedByKey.set(key, Math.min(g, q));
    if (g < q) missed.push({ key, quantity: q - g });
    if (g > q) overcounted.push({ key, quantity: g - q });
  }
  for (const [key, g] of got) if (!required.has(key)) invented.push({ key, quantity: g });

  // Catégories (sous-catégorie du catalogue : Lits, Canapés, Rangements…) : un objet du bon type compte,
  // même si la référence exacte diffère (canapé 2 places au lieu de 3 places).
  const catOf = (key: string) => catalog.get(key)?.subcategory ?? "Hors catalogue";
  const refCat = new Map<string, number>();
  const gotCat = new Map<string, number>();
  for (const [key, q] of required) refCat.set(catOf(key), (refCat.get(catOf(key)) ?? 0) + q);
  for (const [key, q] of got) gotCat.set(catOf(key), (gotCat.get(catOf(key)) ?? 0) + q);
  let catCorrect = 0;
  for (const [c, q] of refCat) catCorrect += Math.min(q, gotCat.get(c) ?? 0);

  // Doublons possibles mis de côté : justifiés si l'objet était déjà compté en totalité.
  let justified = 0;
  for (const k of flaggedKeys) if ((got.get(k) ?? 0) >= (required.get(k) ?? 0)) justified++;

  // Volume : la référence est une fourchette (objets obligatoires → + facultatifs).
  let refMin = 0;
  let refOptional = 0;
  let unknownReferenceVolumes = 0;
  for (const r of reference) {
    const v = referenceVolume(r, catalog);
    if (v === null) unknownReferenceVolumes++;
    if (r.optional) refOptional += r.quantity * (v ?? 0);
    else refMin += r.quantity * (v ?? 0);
  }
  const refMax = refMin + refOptional;
  const errorM3 = countedM3 < refMin ? countedM3 - refMin : countedM3 > refMax ? countedM3 - refMax : 0;

  const sum = (m: Map<string, number>) => [...m.values()].reduce((a, b) => a + b, 0);
  return {
    caseId,
    analysed: detected !== null,
    referenceTotal: sum(required),
    detectedTotal: sum(got),
    correct: sum(matchedByKey),
    missed,
    overcounted,
    invented,
    category: { referenceTotal: sum(refCat), detectedTotal: sum(gotCat), correct: catCorrect },
    partial: flaggedFound(reference, matchedByKey, "partial"),
    difficult: flaggedFound(reference, matchedByKey, "difficult"),
    duplicates: { flagged: flaggedKeys.length, justified, hidingRealObject: flaggedKeys.length - justified },
    volume: { countedM3: r3(countedM3), referenceMinM3: r3(refMin), referenceMaxM3: r3(refMax), errorM3: r3(errorM3), unknownReferenceVolumes },
    outsideCatalog,
  };
}

/** Pondération du score de qualité (0–100). Modifiable ici ; toujours affichée dans le rapport. */
export const QUALITY_WEIGHTS = {
  objects: 0.4,
  categories: 0.15,
  volume: 0.15,
  partial: 0.1,
  difficult: 0.1,
  duplicates: 0.1,
} as const;
export type QualityCriterion = keyof typeof QUALITY_WEIGHTS;

export const CRITERION_LABELS: Record<QualityCriterion, string> = {
  objects: "Meubles (F1 rappel/précision)",
  categories: "Catégories (F1)",
  volume: "Volume (1 − erreur relative)",
  partial: "Meubles partiellement cachés (rappel)",
  difficult: "Objets difficiles (rappel)",
  duplicates: "Doublons (1 − surcomptage)",
};

export type CallMetrics = { latencyMs: number; costUsd: number | null; ok: boolean };

export type ModelSummary = {
  model: string;
  cases: number;
  failures: number;
  correct: number;
  referenceTotal: number;
  detectedTotal: number;
  missed: number;
  overcounted: number;
  invented: number;
  recall: number;
  precision: number;
  f1: number;
  categoryF1: number;
  partialRecall: number | null;
  difficultRecall: number | null;
  duplicatesFlagged: number;
  duplicatesJustified: number;
  volumeAbsErrorM3: number;
  volumeRelError: number | null;
  costUsd: number;
  costPerCaseUsd: number;
  latencyTotalMs: number;
  latencyMeanMs: number;
  latencyMaxMs: number;
  criteria: Record<QualityCriterion, number | null>;
  qualityScore: number;
  unmeasured: QualityCriterion[];
};

const ratio = (a: number, b: number, empty: number) => (b === 0 ? empty : a / b);
const f1 = (p: number, r: number) => (p + r === 0 ? 0 : (2 * p * r) / (p + r));

/**
 * Agrégation sur tous les cas (somme des comptes, puis ratios). Un cas en échec (appel refusé, réponse
 * tronquée ou illisible) est noté comme une analyse vide : tous ses objets sont comptés oubliés.
 */
export function summarizeModel(model: string, scores: CaseScore[], calls: CallMetrics[]): ModelSummary {
  const s = (f: (c: CaseScore) => number) => scores.reduce((acc, c) => acc + f(c), 0);
  const correct = s((c) => c.correct);
  const referenceTotal = s((c) => c.referenceTotal);
  const detectedTotal = s((c) => c.detectedTotal);
  const recall = ratio(correct, referenceTotal, 1);
  const precision = ratio(correct, detectedTotal, detectedTotal === 0 && referenceTotal === 0 ? 1 : 0);
  const catRecall = ratio(s((c) => c.category.correct), s((c) => c.category.referenceTotal), 1);
  const catPrecision = ratio(s((c) => c.category.correct), s((c) => c.category.detectedTotal), 0);
  const partialTotal = s((c) => c.partial.total);
  const difficultTotal = s((c) => c.difficult.total);
  const overcounted = s((c) => c.overcounted.reduce((a, o) => a + o.quantity, 0));
  const refVolume = s((c) => c.volume.referenceMinM3);
  const volumeAbsError = s((c) => Math.abs(c.volume.errorM3));
  const volumeRelError = refVolume > 0 ? volumeAbsError / refVolume : null;

  const criteria: Record<QualityCriterion, number | null> = {
    objects: f1(precision, recall),
    categories: f1(catPrecision, catRecall),
    volume: volumeRelError === null ? null : Math.max(0, 1 - volumeRelError),
    partial: partialTotal === 0 ? null : s((c) => c.partial.found) / partialTotal,
    difficult: difficultTotal === 0 ? null : s((c) => c.difficult.found) / difficultTotal,
    duplicates: referenceTotal === 0 ? null : Math.max(0, 1 - overcounted / referenceTotal),
  };
  const measured = (Object.keys(QUALITY_WEIGHTS) as QualityCriterion[]).filter((k) => criteria[k] !== null);
  const weightSum = measured.reduce((a, k) => a + QUALITY_WEIGHTS[k], 0);
  const qualityScore = weightSum === 0 ? 0 : (100 * measured.reduce((a, k) => a + QUALITY_WEIGHTS[k] * (criteria[k] as number), 0)) / weightSum;

  const costUsd = calls.reduce((a, c) => a + (c.costUsd ?? 0), 0);
  const latencies = calls.map((c) => c.latencyMs);
  return {
    model,
    cases: scores.length,
    failures: calls.filter((c) => !c.ok).length,
    correct,
    referenceTotal,
    detectedTotal,
    missed: s((c) => c.missed.reduce((a, m) => a + m.quantity, 0)),
    overcounted,
    invented: s((c) => c.invented.reduce((a, m) => a + m.quantity, 0)),
    recall,
    precision,
    f1: f1(precision, recall),
    categoryF1: f1(catPrecision, catRecall),
    partialRecall: criteria.partial,
    difficultRecall: criteria.difficult,
    duplicatesFlagged: s((c) => c.duplicates.flagged),
    duplicatesJustified: s((c) => c.duplicates.justified),
    volumeAbsErrorM3: r3(volumeAbsError),
    volumeRelError,
    costUsd,
    costPerCaseUsd: calls.length ? costUsd / calls.length : 0,
    latencyTotalMs: latencies.reduce((a, b) => a + b, 0),
    latencyMeanMs: latencies.length ? latencies.reduce((a, b) => a + b, 0) / latencies.length : 0,
    latencyMaxMs: latencies.length ? Math.max(...latencies) : 0,
    criteria,
    qualityScore: Math.round(qualityScore * 10) / 10,
    unmeasured: (Object.keys(QUALITY_WEIGHTS) as QualityCriterion[]).filter((k) => criteria[k] === null),
  };
}

/** Écart de score en deçà duquel deux modèles sont considérés comme de qualité équivalente. */
export const EQUIVALENT_QUALITY_POINTS = 5;

/**
 * Suggestion de compromis (à confirmer par une personne) : le modèle le moins cher, sans échec,
 * dont le score de qualité est à moins de EQUIVALENT_QUALITY_POINTS points du meilleur.
 */
export function suggestCompromise(summaries: ModelSummary[]): { model: string; reason: string } | null {
  if (summaries.length === 0) return null;
  const best = Math.max(...summaries.map((m) => m.qualityScore));
  const candidates = summaries.filter((m) => m.failures === 0 && m.qualityScore >= best - EQUIVALENT_QUALITY_POINTS).sort((a, b) => a.costPerCaseUsd - b.costPerCaseUsd);
  const pick = candidates[0];
  if (!pick) return null;
  return {
    model: pick.model,
    reason: `moins cher des modèles sans échec à moins de ${EQUIVALENT_QUALITY_POINTS} points du meilleur score (${best.toLocaleString("fr-FR")})`,
  };
}
