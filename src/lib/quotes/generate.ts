import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/supabase/database.types";
import { summarizeVolume, volumeBucket, type InventoryItem } from "@/lib/inventory/volume";
import { confidenceLevel } from "@/lib/inventory/confidence";
import { computePrice, type PricingResult, type SelectedOption } from "@/lib/pricing/engine";
import { distanceBetween } from "@/lib/address/distance";
import { requestReference } from "@/lib/requests/status";
import { formalQuoteEligibility } from "@/lib/quotes/eligibility";

type Client = SupabaseClient<Database>;

export type GenerateOutcome =
  | { status: "created"; quoteId: string; version: number; formal: boolean; reasons: string[] }
  | { status: "pricing_not_configured" }
  | { status: "blocked"; blockers: string[] }
  | { status: "error"; message: string };

const point = (lat: number | null, lon: number | null) =>
  lat !== null && lon !== null && !(lat === 0 && lon === 0) ? { latitude: lat, longitude: lon } : null;

/** Identité légale suffisante pour présenter un devis (et non une estimation). */
export function hasLegalIdentity(c: { legal_name: string | null; siret: string | null; address_line1: string | null; postal_code: string | null; city: string | null }) {
  return Boolean(c.legal_name && c.siret && c.address_line1 && c.postal_code && c.city);
}

/**
 * Calcule et enregistre une nouvelle version de devis pour une demande.
 * - « automatic » : après l'analyse ; devis FORMEL envoyé automatiquement seulement si l'entreprise l'a activé
 *   et que toutes les conditions de fiabilité sont réunies (eligibility.ts), sinon ESTIMATION + motifs de validation.
 * - « correction » : après modification de l'inventaire ou des paramètres par le déménageur (statut corrected).
 * La version précédente (non acceptée) passe en « superseded » ; un devis accepté n'est jamais modifié.
 * Toutes les données utilisées sont figées dans des instantanés (grille, entreprise, demande, inventaire).
 */
export async function generateQuote(
  supabase: Client,
  requestId: string,
  options: {
    origin: "automatic" | "correction";
    userId?: string | null;
    changesSummary?: Json | null;
    send?: boolean;
    analysis?: { simulated: boolean; failedRooms: number; roomsWithoutImages: number };
  },
): Promise<GenerateOutcome> {
  const { data: request, error } = await supabase
    .from("quote_requests")
    .select(
      "id, company_id, request_number, moving_date, alternative_moving_date, moving_date_flexible, distance_km, distance_method, selected_options, customer_notes, customers(full_name, email, phone), dwellings(kind, address_line, postal_code, city, latitude, longitude, housing_type, surface_m2, floor, elevator, carrying_distance_m, access_notes)",
    )
    .eq("id", requestId)
    .single();
  if (error || !request) return { status: "error", message: "Demande introuvable." };

  const companyId = request.company_id;
  const [companyRes, settingsRes, optionsRes, surchargesRes, roomsRes, itemsRes, quotesRes] = await Promise.all([
    supabase
      .from("companies")
      .select("name, legal_name, siret, vat_number, email, phone, website, address_line1, address_line2, postal_code, city, logo_path, brand_color, quote_validity_days, payment_terms, quote_terms, insurance_info, reserves_terms, liability_terms, request_reference_prefix, auto_formal_quotes")
      .eq("id", companyId)
      .single(),
    supabase.from("pricing_settings").select("*").eq("company_id", companyId).single(),
    supabase.from("pricing_options").select("id, name, description, pricing_mode, price, is_active").eq("company_id", companyId),
    supabase.from("pricing_item_surcharges").select("name, surcharge").eq("company_id", companyId),
    supabase.from("rooms").select("id, name, position").eq("request_id", requestId).order("position"),
    supabase
      .from("inventory_items")
      .select("id, room_id, name, catalog_key, quantity, unit_volume_m3, source, confidence, possible_duplicate, validated_by_human, removed, merged_into_item_id, is_heavy, volume_source, furniture_catalog(name)")
      .eq("request_id", requestId),
    supabase.from("quotes").select("id, version, status").eq("request_id", requestId).order("version", { ascending: false }),
  ]);
  const company = companyRes.data;
  const settings = settingsRes.data;
  if (!company || !settings) return { status: "error", message: "Paramètres de l'entreprise introuvables." };
  if (!settings.configured_at) return { status: "pricing_not_configured" };

  // Distance (calculée une fois puis conservée sur la demande)
  const origin = request.dwellings.find((d) => d.kind === "origin") ?? null;
  const destination = request.dwellings.find((d) => d.kind === "destination") ?? null;
  let distanceKm = request.distance_km;
  let distanceMethod = request.distance_method as "route" | "estimate" | null;
  if (distanceKm === null) {
    const distance = await distanceBetween(
      origin ? point(origin.latitude, origin.longitude) : null,
      destination ? point(destination.latitude, destination.longitude) : null,
    );
    if (distance) {
      distanceKm = distance.km;
      distanceMethod = distance.method;
      await supabase.from("quote_requests").update({ distance_km: distance.km, distance_method: distance.method }).eq("id", requestId);
    }
  }

  // Volume (règles validées : seuls confirmé + à vérifier sont comptés)
  const roomName = new Map((roomsRes.data ?? []).map((r) => [r.id, r.name]));
  const dbItems = (itemsRes.data ?? []).filter((i) => !i.removed && !i.merged_into_item_id);
  const asVolumeItems: (InventoryItem & { heavy: boolean; catalogName: string | null; volumeSource: string | null })[] = dbItems.map((i) => ({
    id: i.id,
    name: i.name,
    room: i.room_id ? (roomName.get(i.room_id) ?? "Autre") : "Autre",
    quantity: i.quantity,
    unitVolumeM3: Number(i.unit_volume_m3),
    source: i.source === "ai" ? "ai" : "manual",
    confidence: i.confidence === null ? undefined : Number(i.confidence),
    validatedByHuman: i.validated_by_human,
    possibleDuplicate: i.possible_duplicate,
    heavy: i.is_heavy,
    catalogName: i.furniture_catalog?.name ?? null,
    volumeSource: i.volume_source,
  }));
  const volume = summarizeVolume(asVolumeItems);
  const byRoom = new Map<string, InventoryItem[]>();
  for (const item of asVolumeItems) byRoom.set(item.room, [...(byRoom.get(item.room) ?? []), item]);
  const unknownVolumeItems = asVolumeItems.filter((i) => i.volumeSource === "unknown" && !i.validatedByHuman && i.unitVolumeM3 === 0).length;

  const activeOptions = (optionsRes.data ?? []).filter((o) => o.is_active);
  const selected = (Array.isArray(request.selected_options) ? request.selected_options : []) as SelectedOption[];
  const counted = (i: InventoryItem) => volumeBucket(i) !== "potential";
  const pricingInputBase = {
    settings: {
      price_per_m3: Number(settings.price_per_m3),
      minimum_price: Number(settings.minimum_price),
      travel_fee: Number(settings.travel_fee),
      included_distance_km: settings.included_distance_km,
      price_per_extra_km: Number(settings.price_per_extra_km),
      floor_fee_without_elevator: Number(settings.floor_fee_without_elevator),
      floor_fee_small_elevator: Number(settings.floor_fee_small_elevator),
      free_carrying_distance_m: settings.free_carrying_distance_m,
      carrying_fee_per_10m: Number(settings.carrying_fee_per_10m),
      heavy_item_fee: Number(settings.heavy_item_fee),
      vat_rate: Number(settings.vat_rate),
    },
    options: activeOptions.map((o) => ({ id: o.id, name: o.name, pricing_mode: o.pricing_mode, price: Number(o.price) })),
    surcharges: (surchargesRes.data ?? []).map((s) => ({ name: s.name, surcharge: Number(s.surcharge) })),
    selectedOptions: selected,
    distanceKm,
    distanceMethod,
    dwellings: [origin, destination].filter((d) => d !== null).map((d) => ({ kind: d.kind, floor: d.floor, elevator: d.elevator, carrying_distance_m: d.carrying_distance_m })),
  };
  const heavyOf = (items: typeof asVolumeItems) => items.filter((i) => i.heavy).map((i) => ({ name: i.name, catalogName: i.catalogName, quantity: i.quantity }));
  const price: PricingResult = computePrice({ ...pricingInputBase, volumeM3: volume.estimatedM3, heavyItems: heavyOf(asVolumeItems.filter(counted)) });
  if (!price.ok) return { status: "blocked", blockers: price.blockers };
  if ((quotesRes.data ?? []).some((q) => q.status === "accepted")) {
    return { status: "blocked", blockers: ["Le client a accepté un devis : aucune nouvelle version ne peut le remplacer."] };
  }
  const upper = computePrice({ ...pricingInputBase, volumeM3: volume.maxM3, heavyItems: heavyOf(asVolumeItems) });

  const assumptions = [...price.assumptions];
  if (volume.potentialM3 > 0) {
    assumptions.push(`${volume.potentialM3.toLocaleString("fr-FR")} m³ d'objets incertains ne sont pas comptés ; ils pourraient porter le volume à ${volume.maxM3.toLocaleString("fr-FR")} m³.`);
  }
  if (volume.possibleDuplicateM3 > 0) {
    // Un doublon possible reste compté (on ne retire jamais un meuble peut-être réel) : le volume peut être surestimé.
    assumptions.push(`${volume.possibleDuplicateM3.toLocaleString("fr-FR")} m³ d'objets peut-être vus deux fois (doublons possibles) sont comptés en attendant la vérification du déménageur.`);
  }
  if (unknownVolumeItems > 0) assumptions.push(`${unknownVolumeItems} objet${unknownVolumeItems > 1 ? "s" : ""} sans volume de référence, à évaluer par le déménageur.`);

  const previous = quotesRes.data ?? [];
  const eligibility = formalQuoteEligibility({
    autoFormalEnabled: options.origin === "automatic" ? company.auto_formal_quotes : true,
    legalIdentity: hasLegalIdentity(company),
    pricingConfigured: true,
    simulated: options.analysis?.simulated ?? false,
    failedRooms: options.analysis?.failedRooms ?? 0,
    roomsWithoutImages: options.analysis?.roomsWithoutImages ?? 0,
    itemsToReview: volume.itemsToReview,
    potentialM3: volume.potentialM3,
    unknownVolumeItems,
    pricingAssumptions: price.assumptions,
  });
  // Envoi : demandé par le déménageur (validation humaine), ou automatique si toutes les conditions sont réunies.
  const send = options.send === true || (options.origin === "automatic" && eligibility.formal);
  const reviewReasons = options.send ? [] : eligibility.reasons;
  const version = (previous[0]?.version ?? 0) + 1;
  const today = new Date();
  const validUntil = new Date(today.getTime() + company.quote_validity_days * 86_400_000).toISOString().slice(0, 10);

  const { data: inserted, error: insertError } = await supabase
    .from("quotes")
    .insert({
      request_id: requestId,
      company_id: companyId,
      status: send ? "sent" : options.origin === "automatic" ? "generated" : "corrected",
      sent_at: send ? new Date().toISOString() : null,
      version,
      // Un devis n'est « formel » que lorsqu'il est vérifié et envoyé par l'entreprise (identité légale complète).
      kind: send && hasLegalIdentity(company) ? "formal" : "estimate",
      review_reasons: reviewReasons as unknown as Json[],
      origin: options.origin,
      supersedes_id: previous.find((q) => q.status !== "superseded")?.id ?? null,
      lines: price.lines as unknown as Json[],
      total_ht: price.totalHtCents / 100,
      vat_rate: price.vatRate,
      vat_amount: price.vatCents / 100,
      total_ttc: price.totalTtcCents / 100,
      total_ht_cents: price.totalHtCents,
      vat_cents: price.vatCents,
      total_ttc_cents: price.totalTtcCents,
      valid_until: validUntil,
      distance_km: distanceKm,
      distance_method: distanceMethod,
      assumptions: assumptions as unknown as Json[],
      changes_summary: options.changesSummary ?? null,
      created_by: options.userId ?? null,
      volume_snapshot: {
        ...volume,
        billable_m3: price.billableVolumeM3,
        upper_total_ttc_cents: upper.ok ? upper.totalTtcCents : null,
        rooms: [...byRoom.entries()].map(([name, items]) => ({ name, ...summarizeVolume(items) })),
      } as unknown as Json,
      pricing_snapshot: { settings: pricingInputBase.settings, trip_type: settings.trip_type, options: activeOptions, surcharges: pricingInputBase.surcharges, configured_at: settings.configured_at, selected_options: selected } as unknown as Json,
      company_snapshot: { ...company, has_legal_identity: hasLegalIdentity(company) } as unknown as Json,
      request_snapshot: {
        reference: requestReference(company.request_reference_prefix, request.request_number),
        moving_date: request.moving_date,
        alternative_moving_date: request.alternative_moving_date,
        moving_date_flexible: request.moving_date_flexible,
        customer: request.customers,
        customer_notes: request.customer_notes,
        origin,
        destination,
      } as unknown as Json,
      inventory_snapshot: asVolumeItems.map((i) => ({
        name: i.name,
        room: i.room,
        quantity: i.quantity,
        unit_volume_m3: i.unitVolumeM3,
        bucket: volumeBucket(i),
        level: i.source === "manual" || i.validatedByHuman ? "human" : confidenceLevel(i.confidence ?? 0),
        confidence: i.confidence ?? null,
        heavy: i.heavy,
      })) as unknown as Json,
    })
    .select("id")
    .single();
  if (insertError || !inserted) {
    console.error("[quotes] insertion", insertError);
    return { status: "error", message: "Le devis n'a pas pu être enregistré." };
  }

  const toSupersede = previous.filter((q) => !["superseded", "accepted", "refused", "expired", "cancelled"].includes(q.status)).map((q) => q.id);
  if (toSupersede.length > 0) await supabase.from("quotes").update({ status: "superseded" }).in("id", toSupersede);
  await supabase.from("quote_requests").update({ estimated_volume_m3: volume.estimatedM3 }).eq("id", requestId);

  if (send) await supabase.from("quote_requests").update({ status: "quote_sent" }).eq("id", requestId);
  return { status: "created", quoteId: inserted.id, version, formal: send, reasons: reviewReasons };
}
