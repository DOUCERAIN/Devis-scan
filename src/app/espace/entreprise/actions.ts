"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { canManageSettings, requireMembership } from "@/lib/auth/dal";
import { dbErrorMessage, failure, success, validationFailure, type ActionState } from "@/lib/errors";
import { formToObject } from "@/lib/form-data";
import type { Database } from "@/lib/supabase/database.types";
import { brandColorSchema, companyProfileSchema, companyQuoteSettingsSchema, LOGO_MAX_BYTES, LOGO_TYPES } from "@/lib/validation/company";

const FORBIDDEN = "Seuls le propriétaire et les administrateurs peuvent modifier ces informations.";

/** Vérifie côté serveur que l'utilisateur peut modifier les paramètres de son entreprise. */
async function settingsContext() {
  const { company, role } = await requireMembership();
  return { company, allowed: canManageSettings(role) };
}

/** Champs optionnels vidés -> null en base. */
function nullable<T extends Record<string, unknown>>(values: T, keys: (keyof T)[]) {
  const copy: Record<string, unknown> = { ...values };
  for (const key of keys) if (copy[key as string] === undefined) copy[key as string] = null;
  return copy;
}

type CompanyUpdate = Database["public"]["Tables"]["companies"]["Update"];

async function saveCompany(companyId: string, patch: Record<string, unknown>, context: string) {
  const supabase = await createClient();
  // Les clés proviennent exclusivement des schémas de validation ci-dessus.
  const { data, error } = await supabase.from("companies").update(patch as CompanyUpdate).eq("id", companyId).select("id").maybeSingle();
  if (error) return failure(dbErrorMessage(error, context));
  if (!data) return failure(FORBIDDEN);
  revalidatePath("/espace", "layout");
  return null;
}

export async function updateCompanyProfile(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { company, allowed } = await settingsContext();
  if (!allowed) return failure(FORBIDDEN);
  const raw = formToObject(formData);
  const parsed = companyProfileSchema.safeParse(raw);
  if (!parsed.success) return validationFailure(parsed.error, raw);
  const patch = nullable(parsed.data, ["legal_name", "siret", "vat_number", "email", "phone", "website", "address_line1", "address_line2", "postal_code", "city"]);
  return (await saveCompany(company.id, patch, "updateCompanyProfile")) ?? success("Informations enregistrées.");
}

export async function updateQuoteSettings(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { company, allowed } = await settingsContext();
  if (!allowed) return failure(FORBIDDEN);
  const raw = formToObject(formData);
  const parsed = companyQuoteSettingsSchema.safeParse(raw);
  if (!parsed.success) return validationFailure(parsed.error, raw);
  const patch = nullable(parsed.data, ["payment_terms", "quote_terms", "insurance_info", "reserves_terms", "liability_terms"]);
  return (await saveCompany(company.id, patch, "updateQuoteSettings")) ?? success("Paramètres des devis enregistrés.");
}

export async function updateBranding(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { company, allowed } = await settingsContext();
  if (!allowed) return failure(FORBIDDEN);
  const raw = formToObject(formData);
  const parsed = brandColorSchema.safeParse(raw);
  if (!parsed.success) return validationFailure(parsed.error, raw);

  const patch: Record<string, unknown> = {
    brand_color: parsed.data.use_default_color === "on" ? null : parsed.data.brand_color ?? null,
  };
  const supabase = await createClient();
  const file = formData.get("logo");
  let oldLogo: string | null = null;

  if (file instanceof File && file.size > 0) {
    const ext = LOGO_TYPES[file.type];
    if (!ext) return failure("Le logo doit être une image PNG, JPEG ou WebP.", { logo: "Format non accepté." });
    if (file.size > LOGO_MAX_BYTES) return failure("Le logo ne doit pas dépasser 2 Mo.", { logo: "Fichier trop lourd (2 Mo maximum)." });
    // Vérifie la signature réelle du fichier, pas seulement le type annoncé par le navigateur.
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (!matchesImageSignature(bytes, file.type)) return failure("Ce fichier n'est pas une image valide.", { logo: "Fichier invalide." });

    const path = `${company.id}/logo-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("company-assets").upload(path, bytes, { contentType: file.type, upsert: false });
    if (error) {
      console.error("[storage] logo upload", error.message);
      return failure("L'envoi du logo a échoué. Réessayez.");
    }
    oldLogo = company.logo_path;
    patch.logo_path = path;
  } else if (raw.remove_logo === "on") {
    oldLogo = company.logo_path;
    patch.logo_path = null;
  }

  const failed = await saveCompany(company.id, patch, "updateBranding");
  if (failed) return failed;
  if (oldLogo) await supabase.storage.from("company-assets").remove([oldLogo]);
  return success("Identité visuelle enregistrée.");
}

function matchesImageSignature(b: Uint8Array, type: string): boolean {
  if (type === "image/png") return b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47;
  if (type === "image/jpeg") return b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
  if (type === "image/webp") return b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45;
  return false;
}
