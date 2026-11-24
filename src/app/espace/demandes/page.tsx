import type { Metadata } from "next";
import Link from "next/link";
import { Inbox, Plus } from "lucide-react";
import { requireMembership } from "@/lib/auth/dal";
import { listRequests } from "@/lib/data/requests";
import { STATUS_FILTERS, isStatusFilter, type StatusFilter } from "@/lib/requests/status";
import { PageHeader } from "@/components/app/PageHeader";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { RequestList } from "@/components/requests/RequestList";
import { cn } from "@/components/ui/cn";

export const metadata: Metadata = { title: "Demandes" };

export default async function RequestsPage({ searchParams }: PageProps<"/espace/demandes">) {
  const { company } = await requireMembership();
  const params = await searchParams;
  const filter: StatusFilter = isStatusFilter(params.filtre) ? params.filtre : "toutes";
  const items = await listRequests(company.id, filter);

  return (
    <>
      <PageHeader
        title="Demandes de devis"
        description="Toutes les demandes reçues par votre entreprise."
        actions={<ButtonLink href="/espace/demandes/nouvelle"><Plus aria-hidden />Nouvelle demande</ButtonLink>}
      />
      <nav aria-label="Filtrer les demandes" className="flex gap-1 overflow-x-auto rounded-md bg-surface-subtle p-[3px] sm:self-start">
        {(Object.keys(STATUS_FILTERS) as StatusFilter[]).map((key) => (
          <Link
            key={key}
            href={key === "toutes" ? "/espace/demandes" : `/espace/demandes?filtre=${key}`}
            aria-current={filter === key ? "page" : undefined}
            className={cn(
              "rounded-[8px] px-3 py-1.5 text-[13px] font-medium whitespace-nowrap",
              filter === key ? "bg-surface text-ink shadow-sm" : "text-ink-secondary hover:text-ink",
            )}
          >
            {STATUS_FILTERS[key].label}
          </Link>
        ))}
      </nav>
      {items.length === 0 ? (
        <EmptyState icon={<Inbox />} title={filter === "toutes" ? "Aucune demande pour le moment" : "Aucune demande dans cette catégorie"}>
          {filter === "toutes"
            ? "Les demandes de vos clients apparaîtront ici. Vous pouvez saisir une demande reçue par téléphone."
            : "Changez de filtre pour voir les autres demandes."}
        </EmptyState>
      ) : (
        <RequestList items={items} prefix={company.request_reference_prefix} />
      )}
    </>
  );
}
