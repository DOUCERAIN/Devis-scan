import { ArrowRight, ClipboardCheck, Link2, ScanSearch, SlidersHorizontal, Video, ShieldCheck } from "lucide-react";
import { brand } from "@/config/brand";
import { SiteHeader } from "@/components/marketing/SiteHeader";
import { ButtonLink } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { VolumeSummaryCard } from "@/components/inventory/VolumeSummaryCard";
import { InventoryTable } from "@/components/inventory/InventoryTable";
import { SAMPLE_INVENTORY } from "@/lib/inventory/sample";
import { summarizeVolume } from "@/lib/inventory/volume";

const steps = [
  { icon: Video, title: "Le client filme son logement", text: "Depuis son téléphone, pièce par pièce, sans créer de compte. Des conseils simples l'aident à bien cadrer." },
  { icon: ScanSearch, title: "L'IA prépare l'inventaire", text: "Meubles repérés, dimensions et volumes estimés, doublons signalés. Chaque élément porte un niveau de confiance." },
  { icon: ClipboardCheck, title: "Vous vérifiez et envoyez le devis", text: "Vous consultez les vidéos, corrigez ce qui doit l'être et générez un devis à vos tarifs." },
];

const features = [
  { icon: Video, title: "Les vidéos à portée de main", text: "Chaque pièce filmée reste consultable dans votre espace, avec les images analysées." },
  { icon: ShieldCheck, title: "Aucune estimation déguisée", text: "Ce qui est sûr, à vérifier ou incertain est clairement séparé, volume compris." },
  { icon: SlidersHorizontal, title: "Vos tarifs, vos conditions", text: "Prix au m³, frais de déplacement, suppléments d'étage et options : tout se règle." },
  { icon: Link2, title: "Un lien à vos couleurs", text: "Vos clients font leur demande sur une page à votre logo, intégrable à votre site." },
];

export default function Home() {
  const summary = summarizeVolume(SAMPLE_INVENTORY);

  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <section className="mx-auto grid max-w-content items-center gap-10 px-4 pt-12 pb-16 sm:px-8 lg:grid-cols-[1.1fr_1fr] lg:pt-20 lg:pb-24">
          <div className="flex flex-col gap-6">
            <h1 className="text-[32px] leading-10 font-bold tracking-[-0.02em] text-ink sm:text-[40px] sm:leading-[48px]">
              Des devis de déménagement fiables, à partir de quelques vidéos
            </h1>
            <p className="max-w-reading text-[17px] leading-7 text-ink-secondary">{brand.description}</p>
            <div className="flex flex-wrap gap-3">
              <ButtonLink href="#exemple" size="lg">
                Voir un exemple d&apos;inventaire
                <ArrowRight aria-hidden />
              </ButtonLink>
              <ButtonLink href="#fonctionnement" size="lg" variant="secondary">
                Comment ça marche
              </ButtonLink>
            </div>
            <p className="text-[13px] leading-5 text-ink-muted">
              {brand.name} est en cours de développement. Les premières entreprises de déménagement pourront bientôt le tester.
            </p>
          </div>
          <VolumeSummaryCard summary={summary} audience="client" className="shadow-md" />
        </section>

        <section id="fonctionnement" className="scroll-mt-20 border-y border-border bg-surface">
          <div className="mx-auto flex max-w-content flex-col gap-8 px-4 py-12 sm:px-8 lg:py-16">
            <div className="flex max-w-reading flex-col gap-2">
              <p className="text-xs leading-4 font-semibold tracking-[0.06em] text-brand uppercase">Fonctionnement</p>
              <h2 className="text-[22px] leading-[30px] font-bold tracking-[-0.01em]">Trois étapes, de la vidéo au devis</h2>
            </div>
            <ol className="grid gap-4 md:grid-cols-3">
              {steps.map(({ icon: Icon, title, text }, i) => (
                <li key={title} className="flex flex-col gap-3 rounded-lg border border-border bg-canvas p-5">
                  <span className="flex items-center gap-3">
                    <span aria-hidden className="grid size-10 place-items-center rounded-full bg-brand-soft text-brand">
                      <Icon className="size-5" strokeWidth={1.75} />
                    </span>
                    <span className="text-xs leading-4 font-semibold text-ink-muted">Étape {i + 1}</span>
                  </span>
                  <h3 className="text-lg leading-[26px] font-semibold">{title}</h3>
                  <p className="text-sm leading-[22px] text-ink-secondary">{text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="exemple" className="mx-auto flex max-w-content scroll-mt-20 flex-col gap-6 px-4 py-12 sm:px-8 lg:py-16">
          <div className="flex max-w-reading flex-col gap-2">
            <p className="text-xs leading-4 font-semibold tracking-[0.06em] text-brand uppercase">Espace déménageur</p>
            <h2 className="text-[22px] leading-[30px] font-bold tracking-[-0.01em]">Ce que vous voyez pour chaque demande</h2>
            <p className="text-ink-secondary">
              Un inventaire où le doute est visible : les éléments incertains et les doublons possibles ne sont pas comptés tant que vous ne les avez pas confirmés.
            </p>
            <div><Badge tone="neutral">Exemple avec des données fictives</Badge></div>
          </div>
          <div className="grid items-start gap-6 lg:grid-cols-[1.3fr_1fr]">
            <InventoryTable items={SAMPLE_INVENTORY} />
            <VolumeSummaryCard summary={summary} audience="pro" />
          </div>
        </section>

        <section className="border-t border-border bg-surface">
          <div className="mx-auto flex max-w-content flex-col gap-8 px-4 py-12 sm:px-8 lg:py-16">
            <h2 className="max-w-reading text-[22px] leading-[30px] font-bold tracking-[-0.01em]">Pensé pour les entreprises de déménagement</h2>
            <ul className="grid gap-x-8 gap-y-6 sm:grid-cols-2">
              {features.map(({ icon: Icon, title, text }) => (
                <li key={title} className="flex gap-4">
                  <Icon aria-hidden className="mt-0.5 size-5 shrink-0 text-brand" strokeWidth={1.75} />
                  <div>
                    <h3 className="text-base leading-6 font-semibold">{title}</h3>
                    <p className="text-sm leading-[22px] text-ink-secondary">{text}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </main>
      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-content flex-wrap justify-between gap-2 px-4 py-6 text-[13px] leading-5 text-ink-muted sm:px-8">
          <span>{brand.name}</span>
          <span>Version de développement</span>
        </div>
      </footer>
    </>
  );
}
