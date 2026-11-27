import { ClipboardCheck, MapPin, Smartphone, Video } from "lucide-react";
import { ButtonLink } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { stepHref } from "@/lib/public-request/steps";
import { NewRequestButton, RestartButton, SimulationButton } from "@/components/customer/NewRequestForms";
import { testToolsEnabled } from "@/lib/public-request/test-tools";
import { formatDate } from "@/lib/requests/labels";
import { loadContext } from "./load";

const STEPS = [
  { icon: MapPin, title: "Votre déménagement", text: "Adresses, étages, ascenseur, date souhaitée et dates alternatives." },
  { icon: Video, title: "Votre inventaire, à votre choix", text: "Filmez chaque pièce avec votre téléphone, ou choisissez vos meubles dans une liste." },
  { icon: ClipboardCheck, title: "Votre devis immédiat", text: "Vous vérifiez votre inventaire et recevez votre devis aussitôt, calculé avec les tarifs de l'entreprise." },
];

export default async function CustomerHome({ params }: PageProps<"/d/[slug]">) {
  const { slug } = await params;
  const { company, draft, lastSent } = await loadContext(slug);
  // Demande en cours (non envoyée) : reprise possible. Demande envoyée : conservée, ne bloque rien.
  const inProgress = draft !== null;
  const testTools = await testToolsEnabled(company.id);

  return (
    <>
      <section className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-5 sm:p-8">
        <p className="text-xs leading-4 font-semibold tracking-[0.06em] text-brand uppercase">Demande de devis</p>
        <h1 className="text-[28px] leading-9 font-bold sm:text-[34px] sm:leading-[42px]">Estimez votre déménagement avec {company.name}</h1>
        <p className="text-[17px] leading-7 text-ink-secondary">
          Décrivez votre déménagement, puis filmez vos pièces ou indiquez vos meubles vous-même. Vous recevez votre devis {company.name} dès votre inventaire validé, sans visite préalable.
        </p>
        {lastSent ? (
          <Alert tone="success" title={`Votre demande${lastSent.submitted_at ? ` du ${formatDate(lastSent.submitted_at)}` : ""} a bien été envoyée`}>
            {company.name} l&apos;a reçue. <a href={stepHref(slug, "envoyee")} className="font-semibold underline" data-testid="see-last-request">Voir ma demande</a>
          </Alert>
        ) : null}
        {inProgress ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
            <ButtonLink href={stepHref(slug, "trajet")} size="lg" block className="sm:w-auto" data-testid="resume-request">Reprendre ma demande en cours</ButtonLink>
            <RestartButton slug={slug} label="Commencer une nouvelle demande" />
          </div>
        ) : lastSent ? (
          <NewRequestButton slug={slug} />
        ) : (
          <ButtonLink href={stepHref(slug, "trajet")} size="lg" block className="sm:w-auto" data-testid="start-request">Commencer ma demande</ButtonLink>
        )}
        {testTools ? <SimulationButton slug={slug} /> : null}
        <p className="flex items-center gap-2 text-sm text-ink-muted">
          <Smartphone aria-hidden className="size-4" />Environ 10 minutes · sans création de compte
        </p>
      </section>
      <section aria-label="Déroulement" className="flex flex-col gap-3">
        {STEPS.map(({ icon: Icon, title, text }) => (
          <div key={title} className="flex items-start gap-4 rounded-lg border border-border bg-surface p-4">
            <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-full bg-brand-soft text-brand">
              <Icon className="size-5" strokeWidth={1.75} />
            </span>
            <div>
              <h2 className="text-base leading-6 font-semibold">{title}</h2>
              <p className="text-sm text-ink-secondary">{text}</p>
            </div>
          </div>
        ))}
      </section>
      {(company.email || company.phone) && (
        <p className="text-sm text-ink-secondary">
          Une question ? Contactez {company.name}
          {company.phone && <> au <a className="font-medium text-brand" href={`tel:${company.phone.replace(/\s/g, "")}`}>{company.phone}</a></>}
          {company.email && <> ou par e-mail à <a className="font-medium text-brand" href={`mailto:${company.email}`}>{company.email}</a></>}.
        </p>
      )}
    </>
  );
}
