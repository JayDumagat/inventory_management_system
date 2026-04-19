import { z } from "zod";

export const changePlanSchema = z.object({
  planKey: z.enum(["free", "pro", "enterprise"]),
  reason: z.string().max(500).optional(),
  scheduleForPeriodEnd: z.boolean().optional().default(false),
});

export const addAddonSchema = z.object({
  addonKey: z.string().min(1).max(100),
  quantity: z.number().int().min(1).max(100).optional().default(1),
});

export const removeAddonSchema = z.object({
  addonKey: z.string().min(1).max(100),
});
