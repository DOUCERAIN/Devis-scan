import Link from "next/link";
import { Logo } from "@/components/ui/Logo";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-10 border-b border-border bg-surface/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-content items-center justify-between gap-4 px-4 sm:px-8">
        <Link href="/" className="rounded-md">
          <Logo />
        </Link>
        <nav aria-label="Navigation du site" className="flex items-center gap-2">
          <span className="hidden sm:block"><Badge tone="neutral">En développement</Badge></span>
          <Link href="#fonctionnement" className="hidden rounded-md px-3 py-2 text-sm font-medium text-ink-secondary hover:text-ink md:inline">
            Fonctionnement
          </Link>
          <Link href="/connexion" className="rounded-md px-3 py-2 text-sm font-medium text-ink-secondary hover:text-ink">
            Connexion
          </Link>
          <ButtonLink href="/inscription" size="sm">Créer un compte</ButtonLink>
        </nav>
      </div>
    </header>
  );
}
