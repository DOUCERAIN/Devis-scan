import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";

/**
 * Couche d'accès aux données d'identité (« Data Access Layer »).
 * Chaque page et chaque action privée passe par ces fonctions : on ne fait
 * jamais confiance à une information d'identité envoyée par le navigateur.
 */

export type MemberRole = Database["public"]["Enums"]["member_role"];
export type Company = Database["public"]["Tables"]["companies"]["Row"];

export type CurrentUser = { id: string; email: string | null };
export type Membership = { company: Company; role: MemberRole };

/** Utilisateur connecté (jeton vérifié) ou null. Mis en cache le temps de la requête. */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const sub = data?.claims?.sub;
  if (error || !sub) return null;
  return { id: sub, email: typeof data.claims.email === "string" ? data.claims.email : null };
});

export async function requireUser(next?: string): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect(next ? `/connexion?suivant=${encodeURIComponent(next)}` : "/connexion");
  return user;
}

/** Entreprise de l'utilisateur connecté et son rôle (null s'il n'en a pas encore). */
export const getMembership = cache(async (): Promise<Membership | null> => {
  const user = await getCurrentUser();
  if (!user) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("company_members")
    .select("role, company:companies(*)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error("[dal] getMembership", { code: error.code, message: error.message });
    throw new Error("Impossible de charger votre entreprise.");
  }
  if (!data?.company) return null;
  return { company: data.company as Company, role: data.role };
});

/** Exige un utilisateur rattaché à une entreprise ; sinon redirige vers l'étape adaptée. */
export async function requireMembership(): Promise<CurrentUser & Membership> {
  const user = await requireUser();
  const membership = await getMembership();
  if (!membership) redirect("/espace/bienvenue");
  return { ...user, ...membership };
}

export const SETTINGS_ROLES: readonly MemberRole[] = ["owner", "admin"];

export function canManageSettings(role: MemberRole): boolean {
  return SETTINGS_ROLES.includes(role);
}

export const ROLE_LABELS: Record<MemberRole, string> = {
  owner: "Propriétaire",
  admin: "Administrateur",
  member: "Collaborateur",
};
