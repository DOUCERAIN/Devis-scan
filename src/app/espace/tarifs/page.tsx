import type { Metadata } from "next";
import { canManageSettings, requireMembership } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { dbErrorMessage } from "@/lib/errors";
import { PageHeader } from "@/components/app/PageHeader";
import { Card, CardHeader } from "@/components/ui/Card";
import { Alert } from "@/components/ui/Alert";
import { NewOptionForm, NewSurchargeForm, OptionRow, PricingSettingsForm, SurchargeList } from "./PricingForms";

export const metadata: Metadata = { title: "Tarifs et options" };

export default async function PricingPage() {
  const { company, role } = await requireMembership();
  const disabled = !canManageSettings(role);
  const supabase = await createClient();
  const [settings, options, surcharges] = await Promise.all([
    supabase.from("pricing_settings").select("*").eq("company_id", company.id).maybeSingle(),
    supabase.from("pricing_options").select("*").eq("company_id", company.id).order("position").order("created_at"),
    supabase.from("pricing_item_surcharges").select("*").eq("company_id", company.id).order("name"),
  ]);
  const error = settings.error ?? options.error ?? surcharges.error;
  if (error) throw new Error(dbErrorMessage(error, "PricingPage"));

  return (
    <>
      <PageHeader title="Tarifs et options" description="Votre grille de prix, utilisée pour calculer les estimations de vos devis. Tous les montants sont hors taxes." />
      {disabled && <Alert tone="info" title="Lecture seule">Seuls le propriétaire et les administrateurs peuvent modifier les tarifs.</Alert>}
      {settings.data && !settings.data.configured_at ? (
        <Alert tone="warning" title="Grille jamais enregistrée">
          Les valeurs ci-dessous sont des exemples. Tant que vous ne les avez pas vérifiées et enregistrées, aucune estimation automatique n&apos;est présentée à vos clients.
        </Alert>
      ) : (
        <Alert tone="info" title="Calcul automatique">
          Cette grille sert à calculer l&apos;estimation présentée au client après l&apos;analyse de ses vidéos. Une modification ne change pas les devis déjà établis.
        </Alert>
      )}
      <Card as="section">
        <CardHeader title="Grille tarifaire" />
        {settings.data ? <PricingSettingsForm settings={settings.data} disabled={disabled} /> : <p className="text-sm text-ink-muted">Grille introuvable.</p>}
      </Card>
      <Card as="section">
        <CardHeader title="Options et prestations" />
        <p className="-mt-2 text-sm text-ink-secondary">Prestations que vos clients pourront ajouter à leur demande.</p>
        <ul className="flex flex-col gap-3">
          {(options.data ?? []).map((o) => <OptionRow key={o.id} option={o} disabled={disabled} />)}
        </ul>
        {!disabled && <NewOptionForm />}
      </Card>
      <Card as="section">
        <CardHeader title="Objets volumineux ou spécifiques" />
        <p className="-mt-2 text-sm text-ink-secondary">Suppléments dédiés (piano, coffre-fort…), à la place du supplément « objet lourd » par défaut.</p>
        <SurchargeList items={surcharges.data ?? []} disabled={disabled} />
        {!disabled && <NewSurchargeForm />}
      </Card>
    </>
  );
}
