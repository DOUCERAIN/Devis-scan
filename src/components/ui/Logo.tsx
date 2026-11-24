import { Package } from "lucide-react";
import { brand } from "@/config/brand";
import { cn } from "./cn";

/**
 * Logo provisoire : carré bleu avec une icône colis et le nom du produit.
 * À remplacer par le logo définitif quand la marque sera choisie.
 */
export function Logo({ className, showName = true }: { className?: string; showName?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <span aria-hidden className="grid size-[30px] place-items-center rounded-[8px] bg-brand text-on-brand">
        <Package className="size-[18px]" strokeWidth={1.75} />
      </span>
      {showName ? (
        <span className="font-display text-base leading-6 font-bold whitespace-nowrap text-ink">{brand.name}</span>
      ) : (
        <span className="sr-only">{brand.name}</span>
      )}
    </span>
  );
}
