import type { Metadata } from "next";
import Link from "next/link";
import { LoginForm } from "./LoginForm";
import { Alert } from "@/components/ui/Alert";
import { safeInternalPath } from "@/lib/form-data";

export const metadata: Metadata = { title: "Connexion" };

const MESSAGES: Record<string, { tone: "success" | "info"; title: string }> = {
  deconnecte: { tone: "info", title: "Vous êtes déconnecté." },
  "compte-confirme": { tone: "success", title: "Adresse e-mail confirmée. Connectez-vous pour continuer." },
};

export default async function LoginPage({ searchParams }: PageProps<"/connexion">) {
  const params = await searchParams;
  const next = typeof params.suivant === "string" ? safeInternalPath(params.suivant) : undefined;
  const message = typeof params.message === "string" ? MESSAGES[params.message] : undefined;
  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="text-[26px] leading-[34px] font-bold">Connexion</h1>
        <p className="text-ink-secondary">Accédez à l&apos;espace de votre entreprise.</p>
      </div>
      {message && <Alert tone={message.tone} title={message.title} />}
      <LoginForm next={next} />
      <p className="text-center text-sm text-ink-secondary">
        Pas encore de compte ?{" "}
        <Link href="/inscription" className="font-medium text-brand hover:underline">Créer un compte</Link>
      </p>
    </>
  );
}
