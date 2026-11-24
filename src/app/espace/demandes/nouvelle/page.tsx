import type { Metadata } from "next";
import Link from "next/link";
import { requireMembership } from "@/lib/auth/dal";
import { PageHeader } from "@/components/app/PageHeader";
import { NewRequestForm } from "./NewRequestForm";

export const metadata: Metadata = { title: "Nouvelle demande" };

export default async function NewRequestPage() {
  await requireMembership();
  return (
    <>
      <Link href="/espace/demandes" className="-mb-4 text-sm font-medium text-brand hover:underline">← Demandes</Link>
      <PageHeader
        title="Saisir une demande"
        description="Pour une demande reçue par téléphone, par e-mail ou en agence. Les champs marqués facultatifs pourront être complétés plus tard."
      />
      <NewRequestForm />
    </>
  );
}
