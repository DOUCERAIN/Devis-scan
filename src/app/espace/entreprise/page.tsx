import type { Metadata } from "next";
import { canManageSettings, requireMembership } from "@/lib/auth/dal";
import { companyLogoUrl } from "@/lib/company/logo";
import { PageHeader } from "@/components/app/PageHeader";
import { Card, CardHeader } from "@/components/ui/Card";
import { Alert } from "@/components/ui/Alert";
import { BrandingForm, CompanyProfileForm, QuoteSettingsForm } from "./CompanyForms";

export const metadata: Metadata = { title: "Entreprise" };

export default async function CompanyPage() {
  const { company, role } = await requireMembership();
  const disabled = !canManageSettings(role);
  return (
    <>
      <PageHeader title="Entreprise" description="Ces informations apparaissent sur vos devis et sur la page de demande de vos clients." />
      {disabled && <Alert tone="info" title="Lecture seule">Seuls le propriétaire et les administrateurs peuvent modifier ces informations.</Alert>}
      <Card as="section">
        <CardHeader title="Informations et coordonnées" />
        <CompanyProfileForm company={company} disabled={disabled} />
      </Card>
      <Card as="section">
        <div id="marque" className="scroll-mt-24"><CardHeader title="Identité visuelle" /></div>
        <BrandingForm company={company} disabled={disabled} logoUrl={companyLogoUrl(company.logo_path)} />
      </Card>
      <Card as="section">
        <div id="devis" className="scroll-mt-24"><CardHeader title="Devis et données" /></div>
        <QuoteSettingsForm company={company} disabled={disabled} />
      </Card>
      <Card as="section">
        <CardHeader title="Lien de demande de devis" />
        <p className="text-sm text-ink-secondary">
          Identifiant de votre lien : <code className="rounded-sm bg-canvas px-1.5 py-0.5 text-ink">{company.slug}</code>
        </p>
        <p className="text-sm text-ink-muted">La page publique où vos clients filmeront leur logement sera activée lors de la prochaine étape du développement.</p>
      </Card>
    </>
  );
}
