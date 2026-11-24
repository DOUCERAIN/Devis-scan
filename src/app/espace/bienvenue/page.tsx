import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getMembership, requireUser } from "@/lib/auth/dal";
import { CreateCompanyForm } from "./CreateCompanyForm";

export const metadata: Metadata = { title: "Bienvenue" };

export default async function WelcomePage() {
  await requireUser();
  if (await getMembership()) redirect("/espace");
  return (
    <div className="flex flex-col gap-6 rounded-lg border border-border bg-surface p-6 sm:p-8">
      <div className="flex flex-col gap-2">
        <p className="text-xs leading-4 font-semibold tracking-[0.06em] text-brand uppercase">Dernière étape</p>
        <h1 className="text-[26px] leading-[34px] font-bold">Créez l&apos;espace de votre entreprise</h1>
        <p className="text-ink-secondary">
          Vos demandes de devis, vos tarifs et vos réglages seront rangés dans cet espace, visible uniquement par votre équipe.
        </p>
      </div>
      <CreateCompanyForm />
    </div>
  );
}
