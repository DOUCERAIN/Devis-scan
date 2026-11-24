import type { Metadata } from "next";
import { Phone } from "lucide-react";
import { brand } from "@/config/brand";
import { brandCssVariables } from "@/lib/company/color";
import { CompanyBadge } from "@/components/app/CompanyBadge";
import { loadContext } from "./load";

export async function generateMetadata({ params }: LayoutProps<"/d/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const { company } = await loadContext(slug);
  return { title: { absolute: `Demande de devis · ${company.name}` }, robots: { index: false, follow: false } };
}

/** Pages du particulier, aux couleurs de l'entreprise de déménagement. */
export default async function CustomerLayout({ children, params }: LayoutProps<"/d/[slug]">) {
  const { slug } = await params;
  const { company } = await loadContext(slug);
  return (
    <div style={brandCssVariables(company.brand_color)} className="flex min-h-full flex-1 flex-col bg-canvas">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex h-16 max-w-[720px] items-center justify-between gap-3 px-4">
          <span className="flex min-w-0 items-center gap-2.5">
            <CompanyBadge name={company.name} logoPath={company.logo_path} color={company.brand_color} size={34} />
            <span className="truncate font-display text-base font-bold text-ink">{company.name}</span>
          </span>
          {company.phone && (
            <a href={`tel:${company.phone.replace(/\s/g, "")}`} className="inline-flex h-11 items-center gap-1.5 rounded-md px-2 text-sm font-medium text-brand hover:bg-brand-soft">
              <Phone aria-hidden className="size-4" />
              <span className="hidden sm:inline">{company.phone}</span>
              <span className="sm:hidden">Appeler</span>
            </a>
          )}
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-[720px] flex-1 flex-col gap-6 px-4 py-6 sm:py-10">{children}</main>
      <footer className="border-t border-border bg-surface">
        <div className="mx-auto flex max-w-[720px] flex-col gap-1 px-4 py-5 text-xs text-ink-muted sm:flex-row sm:justify-between">
          <span>Vos informations et vidéos sont transmises uniquement à {company.name}.</span>
          <span>{brand.poweredBy}</span>
        </div>
      </footer>
    </div>
  );
}
