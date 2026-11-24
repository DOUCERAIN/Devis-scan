import type { Metadata } from "next";
import type { CSSProperties } from "react";
import { Plus, FileText, Pencil, Trash2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { ConfidenceBadge } from "@/components/ui/ConfidenceBadge";
import { Alert } from "@/components/ui/Alert";
import { Card, CardHeader } from "@/components/ui/Card";
import { TextField } from "@/components/ui/Field";
import { Logo } from "@/components/ui/Logo";
import { VolumeSummaryCard } from "@/components/inventory/VolumeSummaryCard";
import { SAMPLE_INVENTORY } from "@/lib/inventory/sample";
import { summarizeVolume } from "@/lib/inventory/volume";
import { brand } from "@/config/brand";

export const metadata: Metadata = { title: "Charte des composants", robots: { index: false, follow: false } };

/** Exemple de marque blanche : seule la couleur principale change. */
const whiteLabel = {
  "--ds-brand": "#1f6e55",
  "--ds-brand-hover": "#195a45",
  "--ds-brand-pressed": "#144838",
  "--ds-brand-soft": "#e7f3ee",
  "--ds-brand-soft-strong": "#cfe6dc",
} as CSSProperties;

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-[22px] leading-[30px] font-bold">{title}</h2>
      {children}
    </section>
  );
}

export default function ChartePage() {
  const summary = summarizeVolume(SAMPLE_INVENTORY);
  return (
    <main className="mx-auto flex w-full max-w-content flex-col gap-12 px-4 py-10 sm:px-8">
      <div className="flex flex-col gap-3">
        <Logo />
        <h1 className="text-[26px] leading-[34px] font-bold sm:text-[30px] sm:leading-[38px]">Charte des composants</h1>
        <p className="max-w-reading text-ink-secondary">Page interne de contrôle : chaque composant de la charte {brand.name}, tel qu&apos;il est réellement codé.</p>
      </div>

      <Section title="Boutons">
        <div className="flex flex-wrap items-center gap-3">
          <Button><FileText aria-hidden />Générer le devis</Button>
          <Button variant="secondary"><Pencil aria-hidden />Modifier</Button>
          <Button variant="tertiary"><Plus aria-hidden />Ajouter un meuble</Button>
          <Button variant="danger"><Trash2 aria-hidden />Supprimer</Button>
          <Button size="sm" variant="secondary">Exporter</Button>
          <Button disabled>Envoyer</Button>
        </div>
        <div className="max-w-sm"><Button size="lg" block>Pièce suivante<ArrowRight aria-hidden /></Button></div>
      </Section>

      <Section title="Statuts et confiance">
        <div className="flex flex-wrap gap-2">
          <Badge tone="brand">Nouveau</Badge>
          <Badge tone="warning">Analyse à vérifier</Badge>
          <Badge>Devis envoyé</Badge>
          <Badge tone="success">Accepté</Badge>
          <Badge tone="danger">Refusé</Badge>
        </div>
        <div className="flex flex-wrap gap-2">
          <ConfidenceBadge audience="pro" score={0.94} />
          <ConfidenceBadge audience="pro" score={0.68} />
          <ConfidenceBadge audience="pro" score={0.41} />
          <ConfidenceBadge audience="pro" score={0.9} possibleDuplicate />
        </div>
        <div className="flex flex-wrap gap-2">
          <ConfidenceBadge audience="client" score={0.94} />
          <ConfidenceBadge audience="client" score={0.68} />
          <ConfidenceBadge audience="client" score={0.41} />
        </div>
      </Section>

      <Section title="Alertes">
        <div className="grid gap-3 md:grid-cols-2">
          <Alert tone="info" title="Analyse en cours">Vous recevrez un e-mail dès que l&apos;inventaire sera prêt.</Alert>
          <Alert tone="warning" title="3 éléments à confirmer">Un coup d&apos;œil suffit pour fiabiliser votre devis.</Alert>
          <Alert tone="success" title="Demande envoyée">Le déménageur vous répondra sous 48 h.</Alert>
          <Alert tone="danger" title="L'envoi de la vidéo a échoué">Vérifiez votre connexion puis réessayez.</Alert>
        </div>
      </Section>

      <Section title="Formulaire et carte">
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader title="Adresse de départ" />
            <TextField id="depart" label="Adresse" defaultValue="14 rue Duguesclin, 69006 Lyon" help="Choisissez l'adresse dans la liste pour calculer la distance." />
            <TextField id="etage" label="Étage" inputMode="numeric" defaultValue="quatre" error="Indiquez l'étage en chiffres, par exemple 4." />
          </Card>
          <VolumeSummaryCard summary={summary} audience="client" />
        </div>
      </Section>

      <Section title="Volume côté déménageur">
        <VolumeSummaryCard summary={summary} audience="pro" />
      </Section>

      <Section title="Marque blanche (exemple fictif)">
        <div style={whiteLabel} className="flex max-w-md flex-col gap-4 rounded-lg border border-border bg-surface p-5">
          <span className="flex items-center gap-2 text-sm font-semibold">
            <span aria-hidden className="grid size-7 place-items-center rounded-[7px] bg-brand font-display text-[13px] font-bold text-on-brand">A</span>
            Alpes Déménagement
          </span>
          <div className="h-1 overflow-hidden rounded-full bg-surface-subtle"><div className="h-full w-1/3 rounded-full bg-brand" /></div>
          <p className="text-ink-secondary">Seule la couleur principale change ; les couleurs de confiance restent identiques.</p>
          <div className="flex gap-2"><ConfidenceBadge audience="client" score={0.94} /><ConfidenceBadge audience="client" score={0.68} /></div>
          <Button size="lg" block>Commencer</Button>
          <p className="text-center text-[11px] text-ink-muted">{brand.poweredBy}</p>
        </div>
      </Section>
    </main>
  );
}
