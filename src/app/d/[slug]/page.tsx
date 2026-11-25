import { ClipboardCheck, MapPin, Smartphone, Video } from "lucide-react";
import { ButtonLink } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { stepHref } from "@/lib/public-request/steps";
import { restartRequest } from "./actions";
import { loadContext } from "./load";

const STEPS = [
  { icon: MapPin, title: "Votre déménagement", text: "Adresses, étages, ascenseur, date souhaitée et dates alternatives." },
  { icon: Video, title: "Votre inventaire, à votre choix", text: "Filmez chaque pièce avec votre téléphone, ou choisissez vos meubles dans une liste." },
  { icon: ClipboardCheck, title: "Votre devis immédiat", text: "Vous vérifiez votre inventaire et recevez votre devis aussitôt, calculé avec les tarifs de l'entreprise." },
];

export default async function CustomerHome({ params }: PageProps<"/d/[slug]">) {
  const { slug } = await params;
  const { company, draft } = await loadContext(slug);
  const inProgress = draft?.status === "draft";
  const sent = draft && draft.status !== "draft";

  return (
    <>
      <section className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-5 sm:p-8">
        <p className="text-xs leading-4 font-semibold tracking-[0.06em] text-brand uppercase">Demande de devis</p>
        <h1 className="text-[28px] leading-9 font-bold sm:text-[34px] sm:leading-[42px]">Estimez votre déménagement avec {company.name}</h1>
        <p className="text-[17px] leading-7 text-ink-secondary">
          Décrivez votre déménagement, puis filmez vos pièces ou indiquez vos meubles vous-même. Vous recevez votre devis {company.name} dès votre inventaire validé, sans visite préalable.
        </p>
        {sent ? (
          <Alert tone="success" title="Votre demande a bien été envoyée">
            {company.name} l&apos;a reçue et reviendra vers vous rapidement.
          </Alert>
        ) : inProgress ? (
          <div className="flex flex-col gap-3 sm:flex-row">
            <ButtonLink href={stepHref(slug, "trajet")} size="lg" block className="sm:w-auto">Reprendre ma demande</ButtonLink>
            <form action={restartRequest}>
              <input type="hidden" name="slug" value={slug} />
              <button type="submit" className="inline-flex h-12 w-full items-center justify-center rounded-md px-4 text-sm font-medium text-ink-secondary hover:bg-surface-subtle sm:w-auto">
                Commencer une nouvelle demande
              </button>
            </form>
          </div>
        ) : (
          <ButtonLink href={stepHref(slug, "trajet")} size="lg" block className="sm:w-auto">Commencer ma demande</ButtonLink>
        )}
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
