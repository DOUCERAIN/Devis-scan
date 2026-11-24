import type { Metadata } from "next";
import Link from "next/link";
import { NewPasswordForm } from "./NewPasswordForm";
import { Alert } from "@/components/ui/Alert";
import { getCurrentUser } from "@/lib/auth/dal";

export const metadata: Metadata = { title: "Nouveau mot de passe" };

export default async function NewPasswordPage() {
  const user = await getCurrentUser();
  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="text-[26px] leading-[34px] font-bold">Choisir un nouveau mot de passe</h1>
        {user?.email && <p className="text-ink-secondary">Compte : {user.email}</p>}
      </div>
      {user ? (
        <NewPasswordForm />
      ) : (
        <Alert tone="warning" title="Lien expiré ou invalide">
          Ce lien n&apos;est plus valable.{" "}
          <Link href="/mot-de-passe-oublie" className="font-medium text-brand underline">Demandez un nouvel e-mail</Link>.
        </Alert>
      )}
    </>
  );
}
