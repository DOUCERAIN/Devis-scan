import { COST_DECIMALS, formatCostUsd as usd, type TokenUsage } from "../cost.ts";

/**
 * Garde-fou budgétaire du banc de comparaison.
 *
 * Principe : AVANT chaque appel, le coût MAXIMAL possible de cet appel (worstCaseCallCostUsd) est réservé
 * dans le registre de la campagne. Après l'appel, la réservation est remplacée par le coût réel calculé
 * sur les jetons facturés. Si l'appel échoue sans renvoyer ses jetons (coupure réseau, délai dépassé,
 * arrêt brutal du script), la réservation reste comptée au maximum : le registre surestime, jamais il ne sous-estime.
 *
 * Un appel n'est lancé que si, réservation comprise, ni le plafond par modèle (pour ce passage)
 * ni le plafond de la campagne ne peuvent être dépassés.
 */

/** Plafond ABSOLU de la campagne, non modifiable par option : seule une modification de ce code le change. */
export const CAMPAIGN_HARD_CAP_USD = 5;
/** Plafond par modèle et par passage du banc (premier benchmark). */
export const DEFAULT_PER_MODEL_CAP_USD = 0.75;

export type LedgerEntry = {
  id: string;
  run_id: string;
  at: string;
  model: string;
  case_id: string;
  /** reserved : appel en cours ou interrompu ; settled : coût réel connu ; unknown : échec sans jetons renvoyés. */
  status: "reserved" | "settled" | "unknown";
  reserved_usd: number;
  cost_usd: number | null;
  usage: TokenUsage | null;
  note?: string;
};

export type Ledger = {
  campaign: string;
  hard_cap_usd: number;
  created_at: string;
  entries: LedgerEntry[];
};

export const newLedger = (campaign: string, now = new Date()): Ledger => ({
  campaign,
  hard_cap_usd: CAMPAIGN_HARD_CAP_USD,
  created_at: now.toISOString(),
  entries: [],
});

const round = (n: number) => Number(n.toFixed(COST_DECIMALS));

/** Montant compté pour une entrée : coût réel si connu, sinon la réservation maximale. */
export const countedUsd = (e: LedgerEntry) => (e.status === "settled" && e.cost_usd !== null ? e.cost_usd : e.reserved_usd);

export type BudgetCheck = { ok: true } | { ok: false; reason: string };

export class BudgetGuard {
  readonly perModelCapUsd: number;
  readonly campaignCapUsd: number;
  readonly runId: string;
  readonly ledger: Ledger;

  constructor(opts: { ledger: Ledger; runId: string; perModelCapUsd?: number; campaignCapUsd?: number }) {
    const perModel = opts.perModelCapUsd ?? DEFAULT_PER_MODEL_CAP_USD;
    const campaign = Math.min(opts.campaignCapUsd ?? CAMPAIGN_HARD_CAP_USD, CAMPAIGN_HARD_CAP_USD);
    if (!(perModel > 0) || !(campaign > 0)) throw new Error("Plafonds budgétaires invalides.");
    this.perModelCapUsd = Math.min(perModel, campaign);
    this.campaignCapUsd = campaign;
    this.runId = opts.runId;
    this.ledger = opts.ledger;
  }

  /** Total compté pour toute la campagne (tous passages confondus). */
  campaignSpentUsd(): number {
    return round(this.ledger.entries.reduce((s, e) => s + countedUsd(e), 0));
  }

  /** Total compté pour un modèle dans ce passage. */
  modelSpentUsd(model: string): number {
    return round(this.ledger.entries.filter((e) => e.run_id === this.runId && e.model === model).reduce((s, e) => s + countedUsd(e), 0));
  }

  campaignRemainingUsd(): number {
    return round(Math.max(0, this.campaignCapUsd - this.campaignSpentUsd()));
  }

  check(model: string, worstCaseUsd: number): BudgetCheck {
    if (this.campaignSpentUsd() + worstCaseUsd > this.campaignCapUsd) {
      return { ok: false, reason: `plafond de la campagne (${usd(this.campaignCapUsd)}) : déjà compté ${usd(this.campaignSpentUsd())}, l'appel suivant peut coûter jusqu'à ${usd(worstCaseUsd)}` };
    }
    if (this.modelSpentUsd(model) + worstCaseUsd > this.perModelCapUsd) {
      return { ok: false, reason: `plafond par modèle (${usd(this.perModelCapUsd)}) pour ${model} : déjà compté ${usd(this.modelSpentUsd(model))}, l'appel suivant peut coûter jusqu'à ${usd(worstCaseUsd)}` };
    }
    return { ok: true };
  }

  /** Réserve le coût maximal ; lève une erreur si un plafond pourrait être dépassé (aucun appel ne doit alors partir). */
  reserve(model: string, caseId: string, worstCaseUsd: number, now = new Date()): LedgerEntry {
    const verdict = this.check(model, worstCaseUsd);
    if (!verdict.ok) throw new Error(`Budget : ${verdict.reason}.`);
    const entry: LedgerEntry = {
      id: `${this.runId}#${this.ledger.entries.length + 1}`,
      run_id: this.runId,
      at: now.toISOString(),
      model,
      case_id: caseId,
      status: "reserved",
      reserved_usd: worstCaseUsd,
      cost_usd: null,
      usage: null,
    };
    this.ledger.entries.push(entry);
    return entry;
  }

  /** Coût réel connu (jetons renvoyés par l'API). */
  settle(entry: LedgerEntry, usage: TokenUsage, costUsd: number): void {
    entry.status = "settled";
    entry.usage = usage;
    entry.cost_usd = costUsd;
  }

  /** Échec sans jetons renvoyés : la réservation maximale reste comptée. */
  markUnknown(entry: LedgerEntry, note: string): void {
    entry.status = "unknown";
    entry.note = note;
  }
}

export type PlannedCall = { model: string; caseId: string; worstCaseUsd: number };

export type PlanVerdict = {
  ok: boolean;
  perModel: { model: string; calls: number; worstCaseUsd: number; capUsd: number; ok: boolean }[];
  totalWorstCaseUsd: number;
  campaignSpentUsd: number;
  campaignCapUsd: number;
  reasons: string[];
};

/**
 * Vérification préalable : le pire cas de TOUT le passage doit tenir dans les plafonds.
 * Si ce n'est pas le cas, aucun appel n'est lancé (réduire les cas, les modèles ou max_tokens).
 */
export function checkPlan(guard: BudgetGuard, plan: PlannedCall[]): PlanVerdict {
  const models = [...new Set(plan.map((p) => p.model))];
  const perModel = models.map((model) => {
    const calls = plan.filter((p) => p.model === model);
    const worst = round(calls.reduce((s, c) => s + c.worstCaseUsd, 0));
    const already = guard.modelSpentUsd(model);
    return { model, calls: calls.length, worstCaseUsd: worst, capUsd: guard.perModelCapUsd, ok: already + worst <= guard.perModelCapUsd };
  });
  const total = round(plan.reduce((s, p) => s + p.worstCaseUsd, 0));
  const spent = guard.campaignSpentUsd();
  const reasons: string[] = [];
  for (const m of perModel) if (!m.ok) reasons.push(`${m.model} : pire cas ${usd(m.worstCaseUsd)} > plafond par modèle ${usd(m.capUsd)}`);
  if (spent + total > guard.campaignCapUsd) reasons.push(`campagne : déjà compté ${usd(spent)} + pire cas ${usd(total)} > plafond ${usd(guard.campaignCapUsd)}`);
  return { ok: reasons.length === 0, perModel, totalWorstCaseUsd: total, campaignSpentUsd: spent, campaignCapUsd: guard.campaignCapUsd, reasons };
}
