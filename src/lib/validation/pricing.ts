import { z } from "zod";
import { euroAmount, integerField, optionalText, requiredText } from "./common.ts";

export const pricingSettingsSchema = z.object({
  price_per_m3: euroAmount("Le prix au m³"),
  minimum_price: euroAmount("Le prix minimum"),
  travel_fee: euroAmount("Les frais de déplacement"),
  included_distance_km: integerField("La distance incluse", 0, 2000),
  price_per_extra_km: euroAmount("Le prix par km supplémentaire"),
  floor_fee_without_elevator: euroAmount("Le supplément par étage sans ascenseur"),
  floor_fee_small_elevator: euroAmount("Le supplément par étage avec petit ascenseur"),
  free_carrying_distance_m: integerField("La distance de portage incluse", 0, 1000),
  carrying_fee_per_10m: euroAmount("Le supplément de portage"),
  heavy_item_fee: euroAmount("Le supplément objet lourd"),
  vat_rate: euroAmount("Le taux de TVA").pipe(z.number().max(100, { error: "Le taux de TVA ne peut pas dépasser 100 %." })),
});

export const PRICING_MODES = ["fixed", "per_m3", "per_item"] as const;
export const PRICING_MODE_LABELS: Record<(typeof PRICING_MODES)[number], string> = {
  fixed: "Forfait",
  per_m3: "Par m³",
  per_item: "Par objet",
};

export const pricingOptionSchema = z.object({
  name: requiredText(2, 120, "Le nom de l'option"),
  description: optionalText(500, "La description"),
  pricing_mode: z.enum(PRICING_MODES, { error: "Choisissez un mode de calcul." }),
  price: euroAmount("Le prix"),
});

export const itemSurchargeSchema = z.object({
  name: requiredText(2, 120, "Le nom de l'objet"),
  surcharge: euroAmount("Le supplément"),
});

export const idSchema = z.object({ id: z.uuid({ error: "Identifiant invalide." }) });
