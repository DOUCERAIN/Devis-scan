import { z } from "zod";
import { phoneField, requiredText } from "./common.ts";

export const profileSchema = z.object({
  full_name: requiredText(2, 120, "Votre nom"),
  phone: phoneField,
});
