import Link from "next/link";
import { Logo } from "@/components/ui/Logo";
import { ButtonLink } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <main className="flex flex-1 items-start justify-center px-4 py-16">
      <div className="flex w-full max-w-[440px] flex-col items-start gap-4 rounded-lg border border-border bg-surface p-6 sm:p-8">
        <Link href="/" className="rounded-md"><Logo /></Link>
        <h1 className="text-[26px] leading-[34px] font-bold">Page introuvable</h1>
        <p className="text-ink-secondary">Cette page n&apos;existe pas ou vous n&apos;y avez pas accès.</p>
        <ButtonLink href="/espace" variant="secondary">Retour à mon espace</ButtonLink>
      </div>
    </main>
  );
}
