import type { Metadata } from "next";
import { requireMembership, ROLE_LABELS } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { dbErrorMessage } from "@/lib/errors";
import { PageHeader } from "@/components/app/PageHeader";
import { Card, CardHeader } from "@/components/ui/Card";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";

export const metadata: Metadata = { title: "Équipe" };

const ROLE_HELP = {
  owner: "Tous les droits, y compris la gestion de l'équipe.",
  admin: "Gère les demandes, les tarifs et les informations de l'entreprise.",
  member: "Consulte et traite les demandes de devis.",
} as const;

export default async function TeamPage() {
  const { company, id: userId } = await requireMembership();
  const supabase = await createClient();
  const { data: members, error } = await supabase
    .from("company_members")
    .select("user_id, role, created_at")
    .eq("company_id", company.id)
    .order("created_at");
  if (error) throw new Error(dbErrorMessage(error, "TeamPage"));
  const { data: profiles } = await supabase.from("profiles").select("id, full_name").in("id", (members ?? []).map((m) => m.user_id));
  const names = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));

  return (
    <>
      <PageHeader title="Équipe" description={`Les personnes ayant accès à l'espace de ${company.name}.`} />
      <Card as="section">
        <CardHeader title={`${members?.length ?? 0} membre${(members?.length ?? 0) > 1 ? "s" : ""}`} />
        <ul className="divide-y divide-border">
          {(members ?? []).map((m) => (
            <li key={m.user_id} className="flex flex-wrap items-center justify-between gap-2 py-3">
              <div className="min-w-0">
                <p className="font-medium">{names.get(m.user_id) ?? "Nom non renseigné"}{m.user_id === userId && <span className="text-ink-muted"> (vous)</span>}</p>
                <p className="text-sm text-ink-muted">{ROLE_HELP[m.role]}</p>
              </div>
              <Badge tone={m.role === "owner" ? "brand" : "neutral"}>{ROLE_LABELS[m.role]}</Badge>
            </li>
          ))}
        </ul>
      </Card>
      <Alert tone="info" title="Invitations de collaborateurs">
        La base de données gère déjà plusieurs membres par entreprise avec des rôles distincts. L&apos;invitation de collaborateurs depuis cette page sera ajoutée dans une prochaine étape.
      </Alert>
    </>
  );
}
