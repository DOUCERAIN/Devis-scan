import { cn } from "@/components/ui/cn";
import { companyLogoUrl } from "@/lib/company/logo";

/** Logo de l'entreprise, ou son initiale dans un carré à sa couleur. */
export function CompanyBadge({ name, logoPath, color, size = 28 }: { name: string; logoPath: string | null; color: string | null; size?: number }) {
  const url = companyLogoUrl(logoPath);
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt="" width={size} height={size} className="shrink-0 rounded-[7px] border border-border bg-surface object-contain" style={{ width: size, height: size }} />;
  }
  return (
    <span
      aria-hidden
      className={cn("grid shrink-0 place-items-center rounded-[7px] font-display font-bold text-on-brand", !color && "bg-brand")}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.46), background: color ?? undefined }}
    >
      {name.trim().charAt(0).toUpperCase()}
    </span>
  );
}
