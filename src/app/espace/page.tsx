import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, Circle, Inbox, Plus } from "lucide-react";
import { requireMembership } from "@/lib/auth/dal";
import { dashboardStats, listRequests } from "@/lib/data/requests";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/app/PageHeader";
import { ButtonLink } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { EmptyState } from "@/components/ui/EmptyState";
import { RequestList } from "@/components/requests/RequestList";

export const metadata: Metadata = { title: "Tableau de bord" };

const MESSAGES: Record<string, string> = {
  bienvenue: "Votre espace entreprise est prêt. Complétez vos informations et vos tarifs pour commencer.",
  "mot-de-passe-modifie": "Votre mot de passe a été modifié.",
};

export default async function DashboardPage({ searchParams }: PageProps<"/espace">) {
  const { company } = await requireMembership();
  const params = await searchParams;
  const message = typeof params.message === "string" ? MESSAGES[params.message] : undefined;

  const supabase = await createClient();
  const [stats, recent, profile] = await Promise.all([
    dashboardStats(company.id),
    listRequests(company.id, "toutes", 5),
    supabase.from("profiles").select("full_name").maybeSingle(),
  ]);
  const firstName = profile.data?.full_name?.split(" ")[0];

  const toHandle = stats.byStatus.submitted + stats.byStatus.analyzing + stats.byStatus.to_review;
  const tiles = [
    { label: "À traiter", value: toHandle, hint: "nouvelles ou à vérifier", href: "/espace/demandes?filtre=a_traiter" },
    { label: "Devis envoyés", value: stats.byStatus.quote_sent, hint: "en attente de réponse", href: "/espace/demandes?filtre=envoyees" },
    { label: "Acceptées", value: stats.byStatus.accepted, hint: "devis acceptés", href: "/espace/demandes?filtre=terminees" },
    { label: "Total", value: stats.total, hint: "demandes reçues", href: "/espace/demandes" },
  ];

  const checklist = [
    { done: Boolean(company.email && company.phone && company.city), label: "Coordonnées de l'entreprise", href: "/espace/entreprise" },
    { done: Boolean(company.siret), label: "SIRET et mentions pour les devis", href: "/espace/entreprise#devis" },
    { done: Boolean(company.logo_path), label: "Logo et couleur de marque", href: "/espace/entreprise#marque" },
    { done: Boolean(company.quote_terms), label: "Conditions commerciales", href: "/espace/entreprise#devis" },
  ];
  const remaining = checklist.filter((c) => !c.done);

  return (
    <>
      <PageHeader
        title={firstName ? `Bonjour ${firstName}` : "Tableau de bord"}
        description={`Activité de ${company.name}.`}
        actions={<ButtonLink href="/espace/demandes/nouvelle"><Plus aria-hidden />Nouvelle demande</ButtonLink>}
      />
      {message && <Alert tone="success" title={message} />}

      {remaining.length > 0 && (
        <section aria-labelledby="setup-title" className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4 sm:p-5">
          <div>
            <h2 id="setup-title" className="text-lg leading-[26px] font-semibold">Terminez la configuration</h2>
            <p className="text-sm text-ink-secondary">Ces informations apparaîtront sur vos devis et sur la page de demande de vos clients.</p>
          </div>
          <ul className="grid gap-2 sm:grid-cols-2">
            {checklist.map((item) => (
              <li key={item.label}>
                <Link href={item.href} className="flex items-center gap-2.5 rounded-md bg-canvas px-3 py-2.5 text-sm hover:bg-surface-subtle">
                  {item.done ? (
                    <CheckCircle2 aria-hidden className="size-[18px] text-success" />
                  ) : (
                    <Circle aria-hidden className="size-[18px] text-ink-muted" />
                  )}
                  <span className={item.done ? "text-ink-secondary line-through" : "font-medium text-ink"}>{item.label}</span>
                  <span className="sr-only">{item.done ? "(fait)" : "(à faire)"}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {stats.total === 0 ? (
        <EmptyState
          icon={<Inbox />}
          title="Aucune demande pour le moment"
          action={<ButtonLink href="/espace/demandes/nouvelle" variant="secondary"><Plus aria-hidden />Saisir une demande</ButtonLink>}
        >
          Les demandes de vos clients apparaîtront ici. Vous pouvez déjà saisir une demande reçue par téléphone ou par e-mail.
        </EmptyState>
      ) : (
        <>
          <section aria-label="Indicateurs" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {tiles.map((t) => (
              <Link key={t.label} href={t.href} className="flex flex-col gap-0.5 rounded-lg border border-border bg-surface p-4 shadow-sm hover:border-brand-soft-strong hover:shadow-md">
                <span className="text-[13px] leading-5 text-ink-secondary">{t.label}</span>
                <span className="text-[28px] leading-[34px] font-semibold tabular-nums">{t.value}</span>
                <span className="text-xs leading-4 text-ink-muted">{t.hint}</span>
              </Link>
            ))}
          </section>
          <section aria-labelledby="recent-title" className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <h2 id="recent-title" className="text-[22px] leading-[30px] font-bold">Dernières demandes</h2>
              <Link href="/espace/demandes" className="text-sm font-medium text-brand hover:underline">Tout voir</Link>
            </div>
            <RequestList items={recent} prefix={company.request_reference_prefix} />
          </section>
        </>
      )}
    </>
  );
}
