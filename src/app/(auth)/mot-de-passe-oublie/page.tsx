import type { Metadata } from "next";
import Link from "next/link";
import { ForgotForm } from "./ForgotForm";

export const metadata: Metadata = { title: "Mot de passe oublié" };

export default function ForgotPasswordPage() {
  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="text-[26px] leading-[34px] font-bold">Mot de passe oublié</h1>
        <p className="text-ink-secondary">Indiquez votre adresse e-mail : nous vous enverrons un lien pour en choisir un nouveau.</p>
      </div>
      <ForgotForm />
      <p className="text-center text-sm"><Link href="/connexion" className="font-medium text-brand hover:underline">Retour à la connexion</Link></p>
    </>
  );
}
