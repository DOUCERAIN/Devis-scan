import type { Metadata } from "next";
import Link from "next/link";
import { SignUpForm } from "./SignUpForm";

export const metadata: Metadata = { title: "Créer un compte" };

export default function SignUpPage() {
  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="text-[26px] leading-[34px] font-bold">Créer un compte déménageur</h1>
        <p className="text-ink-secondary">Vous configurerez votre entreprise juste après.</p>
      </div>
      <SignUpForm />
      <p className="text-center text-sm text-ink-secondary">
        Déjà inscrit ?{" "}
        <Link href="/connexion" className="font-medium text-brand hover:underline">Se connecter</Link>
      </p>
    </>
  );
}
