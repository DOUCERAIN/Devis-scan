import { Copy } from "lucide-react";
import { Badge, type BadgeTone } from "./Badge";
import { CONFIDENCE_LABELS, confidenceLevel, formatScore, type ConfidenceLevel } from "@/lib/inventory/confidence";

const toneByLevel: Record<ConfidenceLevel, BadgeTone> = { sure: "success", verify: "warning", uncertain: "danger" };

type Props = {
  /** Score de l'IA entre 0 et 1. */
  score: number;
  /** `pro` affiche le pourcentage ; `client` le libellé seul. */
  audience: "pro" | "client";
  possibleDuplicate?: boolean;
  className?: string;
};

/** Niveau de confiance de l'IA (charte : ConfidenceBadge). La couleur n'est jamais seule. */
export function ConfidenceBadge({ score, audience, possibleDuplicate, className }: Props) {
  if (possibleDuplicate) {
    return (
      <Badge tone="duplicate" icon={<Copy aria-hidden />} className={className}>
        Doublon possible
      </Badge>
    );
  }
  const level = confidenceLevel(score);
  const label = CONFIDENCE_LABELS[level];
  return (
    <Badge tone={toneByLevel[level]} dot className={className}>
      {audience === "pro" ? `${label} · ${formatScore(score)}` : label}
    </Badge>
  );
}
