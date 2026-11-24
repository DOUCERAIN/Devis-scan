import Link from "next/link";
import { requireUser, getMembership, ROLE_LABELS } from "@/lib/auth/dal";
import { countPendingRequests } from "@/lib/data/requests";
import { Logo } from "@/components/ui/Logo";
import { AppNav } from "@/components/app/AppNav";
import { MobileMenu } from "@/components/app/MobileMenu";
import { SignOutButton } from "@/components/app/SignOutButton";
import { CompanyBadge } from "@/components/app/CompanyBadge";

export default async function EspaceLayout({ children }: LayoutProps<"/espace">) {
  const user = await requireUser("/espace");
  const membership = await getMembership();

  // Pas encore d'entreprise : écran d'accueil simple (création de l'entreprise).
  if (!membership) {
    return (
      <div className="flex min-h-full flex-1 flex-col">
        <header className="border-b border-border bg-surface">
          <div className="mx-auto flex h-16 max-w-content items-center justify-between gap-4 px-4 sm:px-8">
            <Link href="/" className="rounded-md"><Logo /></Link>
            <div className="w-auto"><SignOutButton /></div>
          </div>
        </header>
        <main className="mx-auto w-full max-w-reading flex-1 px-4 py-10 sm:py-16">{children}</main>
      </div>
    );
  }

  const { company, role } = membership;
  const pending = await countPendingRequests(company.id);
  const footer = (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2.5 px-2.5 py-1">
        <CompanyBadge name={company.name} logoPath={company.logo_path} color={company.brand_color} />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-ink">{company.name}</p>
          <p className="truncate text-xs text-ink-muted">{user.email} · {ROLE_LABELS[role]}</p>
        </div>
      </div>
      <SignOutButton />
    </div>
  );

  return (
    <div className="flex min-h-full flex-1">
      <div className="hidden w-[248px] shrink-0 border-r border-border bg-surface lg:block">
        <aside className="sticky top-0 flex h-dvh flex-col gap-4 px-3 py-4">
          <Link href="/espace" className="rounded-md px-2.5 pb-2"><Logo /></Link>
          <AppNav pendingCount={pending} />
          <div className="mt-auto border-t border-border pt-3">{footer}</div>
        </aside>
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-border bg-surface px-4 lg:hidden">
          <Link href="/espace" className="rounded-md"><Logo /></Link>
          <MobileMenu pendingCount={pending} footer={footer} />
        </header>
        <main className="mx-auto flex w-full max-w-content flex-1 flex-col gap-8 px-4 py-6 sm:px-8 sm:py-10">{children}</main>
      </div>
    </div>
  );
}
