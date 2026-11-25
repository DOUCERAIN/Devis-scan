import { formatCostUsd, type TokenUsage } from "../cost.ts";
import type { CoverageLine } from "./dataset.ts";
import { modelLabel } from "./models.ts";
import { CRITERION_LABELS, EQUIVALENT_QUALITY_POINTS, QUALITY_WEIGHTS, suggestCompromise, type CaseScore, type ModelSummary, type QualityCriterion } from "./score.ts";

/**
 * Rendu du rapport (Markdown) et des exports tableur (CSV au format français : « ; » et virgule décimale).
 * Aucune donnée n'est inventée : le rapport n'affiche que les appels réellement effectués.
 */

export type ReportCall = {
  caseId: string;
  model: string;
  pass: number;
  servedModel: string | null;
  ok: boolean;
  code: string | null;
  latencyMs: number;
  usage: TokenUsage | null;
  costUsd: number | null;
};

export type ReportInput = {
  title: string;
  generatedAt: Date;
  runId: string;
  status: "complet" | "interrompu";
  stopReason: string | null;
  config: { effort: string; maxOutputTokens: number; repeat: number; perModelCapUsd: number; campaignCapUsd: number; roomsPerRequest: number; pricesCheckedAt: string };
  models: string[];
  cases: { id: string; roomLabel: string; roomType: string; situations: string[]; frames: number; referenceStatus: string }[];
  coverage: { lines: CoverageLine[]; representative: boolean };
  summaries: ModelSummary[];
  caseScores: { model: string; pass: number; score: CaseScore }[];
  calls: ReportCall[];
  budget: { runCountedUsd: number; campaignCountedUsd: number; campaignCapUsd: number };
};

const fr = (n: number, digits = 1) => n.toLocaleString("fr-FR", { maximumFractionDigits: digits, minimumFractionDigits: 0 });
const pct = (n: number | null) => (n === null ? "non mesuré" : `${Math.round(n * 100)} %`);
const sec = (ms: number) => `${fr(ms / 1000, 1)} s`;
const list = (items: { key: string; quantity: number }[]) => items.map((i) => `${i.key} ×${i.quantity}`).join(" ; ") || "aucun";

export function renderMarkdown(r: ReportInput): string {
  const provisional = r.cases.filter((c) => c.referenceStatus !== "validee").length;
  const suggestion = suggestCompromise(r.summaries);
  const lines: string[] = [
    `# ${r.title}`,
    "",
    `Date : ${r.generatedAt.toLocaleString("fr-FR", { timeZone: "Europe/Paris" })} · passage \`${r.runId}\` · statut : **${r.status}**${r.stopReason ? ` (${r.stopReason})` : ""}`,
    "",
  ];
  if (provisional > 0) {
    lines.push(`> **Référence non validée** : ${provisional} cas sur ${r.cases.length} ont un inventaire de référence provisoire. Les écarts mesurés sont indicatifs tant qu'un déménageur ne l'a pas vérifié.`, "");
  }
  if (!r.coverage.representative) {
    lines.push("> **Jeu de données non représentatif** (voir « Couverture » ci-dessous) : ces résultats servent à repérer des défauts, pas à choisir définitivement un modèle.", "");
  }
  lines.push(
    "## Conditions (identiques pour tous les modèles)",
    "",
    `- Mêmes images, dans le même ordre ; mêmes consignes et même catalogue que la production (\`src/lib/ai/prompt.ts\`) ; même post-traitement (\`src/lib/ai/postprocess.ts\`).`,
    `- Effort : ${r.config.effort} · sortie plafonnée à ${r.config.maxOutputTokens.toLocaleString("fr-FR")} jetons (réflexion comprise) · aucune nouvelle tentative automatique · pas de repli vers un autre modèle · ${r.config.repeat} passage(s).`,
    `- Tarifs officiels vérifiés le ${r.config.pricesCheckedAt}. Coûts calculés sur les jetons réellement facturés renvoyés par l'API.`,
    "",
    "## Tableau comparatif final",
    "",
    `| Modèle | Score qualité /100 | Corrects | Oubliés | Inventés ou mal identifiés | En trop (doublons) | Taux de reconnaissance (rappel) | Précision | Catégories (F1) | Partiellement cachés | Difficiles | Erreur de volume | Coût total | Coût moyen / pièce | Projection / demande (${r.config.roomsPerRequest} pièces) | Latence moyenne | Latence max | Échecs |`,
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
    ...r.summaries.map(
      (m) =>
        `| ${modelLabel(m.model)} | ${fr(m.qualityScore)} | ${m.correct} / ${m.referenceTotal} | ${m.missed} | ${m.invented} | ${m.overcounted} | ${pct(m.recall)} | ${pct(m.precision)} | ${pct(m.categoryF1)} | ${pct(m.partialRecall)} | ${pct(m.difficultRecall)} | ${fr(m.volumeAbsErrorM3, 2)} m³${m.volumeRelError === null ? "" : ` (${pct(m.volumeRelError)})`} | ${formatCostUsd(m.costUsd)} | ${formatCostUsd(m.costPerCaseUsd)} | ${formatCostUsd(m.costPerCaseUsd * r.config.roomsPerRequest)} | ${sec(m.latencyMeanMs)} | ${sec(m.latencyMaxMs)} | ${m.failures} |`,
    ),
    "",
    suggestion
      ? `**Suggestion automatique ${provisional > 0 || !r.coverage.representative ? "INDICATIVE (référence non validée ou jeu de données non représentatif) " : ""}(à confirmer par une personne)** : ${modelLabel(suggestion.model)} — ${suggestion.reason}.`
      : "**Suggestion automatique** : aucune (tous les modèles ont au moins un échec, ou aucun résultat).",
    "",
    "## Score de qualité : détail",
    "",
    `Score = moyenne pondérée des critères mesurés, ramenée sur 100. Critère non mesurable sur ce jeu de données → poids réparti sur les autres. Deux modèles à moins de ${EQUIVALENT_QUALITY_POINTS} points sont considérés comme équivalents.`,
    "",
    `| Critère | Poids | ${r.summaries.map((m) => modelLabel(m.model)).join(" | ")} |`,
    `| --- | ---: | ${r.summaries.map(() => "---:").join(" | ")} |`,
    ...(Object.keys(QUALITY_WEIGHTS) as QualityCriterion[]).map(
      (k) => `| ${CRITERION_LABELS[k]} | ${Math.round(QUALITY_WEIGHTS[k] * 100)} % | ${r.summaries.map((m) => pct(m.criteria[k])).join(" | ")} |`,
    ),
    "",
    "## Détail par pièce",
  );
  for (const c of r.cases) {
    lines.push("", `### ${c.roomLabel} (\`${c.id}\`, ${c.frames} images, référence ${c.referenceStatus})`, "");
    lines.push("| Modèle | Passage | Corrects | Oubliés | Inventés ou mal identifiés | En trop | Doublons possibles signalés (comptés) | Volume compté / référence | Coût | Latence | État |", "| --- | ---: | ---: | --- | --- | --- | ---: | --- | ---: | ---: | --- |");
    for (const cs of r.caseScores.filter((x) => x.score.caseId === c.id)) {
      const call = r.calls.find((x) => x.caseId === c.id && x.model === cs.model && x.pass === cs.pass);
      const s = cs.score;
      const refVol = s.volume.referenceMinM3 === s.volume.referenceMaxM3 ? `${fr(s.volume.referenceMinM3, 2)}` : `${fr(s.volume.referenceMinM3, 2)}–${fr(s.volume.referenceMaxM3, 2)}`;
      lines.push(
        `| ${modelLabel(cs.model)} | ${cs.pass} | ${s.correct} / ${s.referenceTotal} | ${list(s.missed)} | ${list(s.invented)} | ${list(s.overcounted)} | ${s.duplicates.flagged} (${s.duplicates.justified} justifiés) | ${fr(s.volume.countedM3, 2)} / ${refVol} m³ | ${formatCostUsd(call?.costUsd ?? null)} | ${call ? sec(call.latencyMs) : "—"} | ${call?.ok ? "analysé" : `échec ${call?.code ?? ""}`} |`,
      );
    }
  }
  lines.push(
    "",
    "## Couverture du jeu de données",
    "",
    "| Élément | Disponible | Objectif | |",
    "| --- | ---: | ---: | --- |",
    ...r.coverage.lines.map((l) => `| ${l.label} | ${l.have} | ${l.target} | ${l.ok ? "atteint" : "manquant"} |`),
    "",
    "## Budget",
    "",
    `- Ce passage : ${formatCostUsd(r.budget.runCountedUsd)} comptés.`,
    `- Campagne : ${formatCostUsd(r.budget.campaignCountedUsd)} comptés sur un plafond absolu de ${formatCostUsd(r.budget.campaignCapUsd)} (registre \`tests/ai-eval/results/ledger.json\`).`,
    "",
    "## Appels",
    "",
    "| Pièce | Modèle demandé | Modèle ayant répondu | Passage | Jetons entrée | Jetons lus en cache | Jetons écrits en cache | Jetons sortie | Coût | Latence | État |",
    "| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |",
    ...r.calls.map(
      (c) =>
        `| ${c.caseId} | ${c.model} | ${c.servedModel ?? "—"} | ${c.pass} | ${c.usage?.inputTokens.toLocaleString("fr-FR") ?? "—"} | ${c.usage?.cacheReadTokens.toLocaleString("fr-FR") ?? "—"} | ${c.usage?.cacheWriteTokens.toLocaleString("fr-FR") ?? "—"} | ${c.usage?.outputTokens.toLocaleString("fr-FR") ?? "—"} | ${formatCostUsd(c.costUsd)} | ${sec(c.latencyMs)} | ${c.ok ? "ok" : `échec ${c.code ?? ""}`} |`,
    ),
    "",
  );
  return lines.join("\n");
}

/** Cellule CSV (format français) : nombres avec virgule décimale, texte entre guillemets si besoin. */
function cell(v: string | number | null): string {
  if (v === null) return "";
  // 6 chiffres significatifs : lisible dans un tableur, et un très petit coût reste visible (jamais arrondi à 0).
  if (typeof v === "number") return Number.isFinite(v) ? String(Number.isInteger(v) ? v : Number(v.toPrecision(6))).replace(".", ",") : "";
  return /[";\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}
const csv = (rows: (string | number | null)[][]) => "﻿" + rows.map((row) => row.map(cell).join(";")).join("\r\n") + "\r\n";

/** Tableau comparatif final (une ligne par modèle). */
export function renderSummaryCsv(summaries: ModelSummary[], roomsPerRequest: number): string {
  return csv([
    ["modele", "score_qualite", "corrects", "reference", "oublies", "inventes_ou_mal_identifies", "en_trop_doublons", "rappel", "precision", "f1", "categories_f1", "rappel_partiels", "rappel_difficiles", "doublons_possibles_signales", "doublons_justifies", "erreur_volume_m3", "erreur_volume_relative", "cout_total_usd", "cout_moyen_piece_usd", `projection_demande_${roomsPerRequest}_pieces_usd`, "latence_moyenne_s", "latence_max_s", "echecs"],
    ...summaries.map((m) => [
      m.model, m.qualityScore, m.correct, m.referenceTotal, m.missed, m.invented, m.overcounted, m.recall, m.precision, m.f1, m.categoryF1, m.partialRecall, m.difficultRecall,
      m.duplicatesFlagged, m.duplicatesJustified, m.volumeAbsErrorM3, m.volumeRelError, m.costUsd, m.costPerCaseUsd, m.costPerCaseUsd * roomsPerRequest,
      m.latencyMeanMs / 1000, m.latencyMaxMs / 1000, m.failures,
    ]),
  ]);
}

/** Détail par pièce et par modèle (une ligne par appel). */
export function renderDetailsCsv(caseScores: ReportInput["caseScores"], calls: ReportCall[]): string {
  return csv([
    ["piece", "modele", "passage", "etat", "corrects", "reference", "oublies", "inventes", "en_trop", "volume_compte_m3", "volume_reference_min_m3", "volume_reference_max_m3", "jetons_entree", "jetons_cache_lus", "jetons_cache_ecrits", "jetons_sortie", "cout_usd", "latence_s"],
    ...caseScores.map(({ model, pass, score: s }) => {
      const c = calls.find((x) => x.caseId === s.caseId && x.model === model && x.pass === pass);
      return [
        s.caseId, model, pass, c?.ok ? "ok" : `echec ${c?.code ?? ""}`, s.correct, s.referenceTotal, list(s.missed), list(s.invented), list(s.overcounted),
        s.volume.countedM3, s.volume.referenceMinM3, s.volume.referenceMaxM3,
        c?.usage?.inputTokens ?? null, c?.usage?.cacheReadTokens ?? null, c?.usage?.cacheWriteTokens ?? null, c?.usage?.outputTokens ?? null, c?.costUsd ?? null, c ? c.latencyMs / 1000 : null,
      ];
    }),
  ]);
}
