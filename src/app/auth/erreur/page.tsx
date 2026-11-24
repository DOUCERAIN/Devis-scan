import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/ui/Logo";
import { Alert } from "@/components/ui/Alert";

export const metadata: Metadata = { title: "Lien invalide" };

const MESSAGES: Record<string, string> = {
  otp_expired: "Ce lien a expiré ou a déjà été utilisé.",
  flow_state_expired: "Ce lien a expiré.",
  bad_code_verifier: "Ce lien doit être ouvert dans le navigateur depuis lequel vous avez fait la demande.",
  missing_token: "Ce lien est incomplet.",
};

export default async function AuthErrorPage({ searchParams }: PageProps<"/auth/erreur">) {
  const { code } = await searchParams;
  const detail = (typeof code === "string" && MESSAGES[code]) || "Ce lien n'est pas valide.";
  return (
    <main className="flex flex-1 items-start justify-center px-4 py-16">
      <div className="flex w-full max-w-[440px] flex-col gap-6 rounded-lg border border-border bg-surface p-6 sm:p-8">
        <Logo />
        <Alert tone="warning" title="Impossible d'utiliser ce lien">{detail}</Alert>
        <p className="text-sm text-ink-secondary">
          Vous pouvez <Link href="/connexion" className="font-medium text-brand underline">vous connecter</Link> ou{" "}
          <Link href="/mot-de-passe-oublie" className="font-medium text-brand underline">demander un nouveau lien</Link>.
        </p>
      </div>
    </main>
  );
}
