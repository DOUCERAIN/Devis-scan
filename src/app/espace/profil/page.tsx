import type { Metadata } from "next";
import { requireMembership } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/app/PageHeader";
import { Card, CardHeader } from "@/components/ui/Card";
import { PasswordForm, ProfileForm } from "./ProfileForms";

export const metadata: Metadata = { title: "Mon profil" };

export default async function ProfilePage() {
  const user = await requireMembership();
  const supabase = await createClient();
  const { data: profile } = await supabase.from("profiles").select("full_name, phone").eq("id", user.id).maybeSingle();
  return (
    <>
      <PageHeader title="Mon profil" description="Vos informations personnelles et votre mot de passe." />
      <Card as="section">
        <CardHeader title="Informations personnelles" />
        <ProfileForm fullName={profile?.full_name ?? null} phone={profile?.phone ?? null} email={user.email} />
      </Card>
      <Card as="section">
        <CardHeader title="Mot de passe" />
        <PasswordForm />
      </Card>
    </>
  );
}
