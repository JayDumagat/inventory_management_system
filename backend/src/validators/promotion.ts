import { z } from "zod";

const dateTimeInputSchema = z.preprocess((value) => {
  if (value === "" || value === null || value === undefined) return undefined;
  if (typeof value !== "string") return value;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toISOString();
}, z.string().datetime().optional());

export const promotionSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional().or(z.literal("")).transform(v => v || undefined),
  code: z.string().max(50).optional().or(z.literal("")).transform(v => v || undefined),
  type: z.enum(["percentage_off", "fixed_amount", "bogo", "free_shipping", "tiered"]),
  discountType: z.enum(["percentage", "fixed"]),
  discountValue: z.number().min(0),
  minimumOrderAmount: z.number().min(0).optional(),
  maximumDiscountAmount: z.number().min(0).optional(),
  buyQuantity: z.number().int().min(1).optional(),
  getQuantity: z.number().int().min(1).optional(),
  scope: z.enum(["order", "category"]).default("order"),
  applicableCategoryIds: z.array(z.string().uuid()).optional().default([]),
  eligibility: z.enum(["all", "new_customer", "specific_customer"]).default("all"),
  specificCustomerId: z.string().uuid().optional(),
  usageLimitTotal: z.number().int().min(1).optional(),
  usageLimitPerCustomer: z.number().int().min(1).optional(),
  startsAt: dateTimeInputSchema,
  endsAt: dateTimeInputSchema,
  isActive: z.boolean().optional().default(true),
  stackable: z.boolean().optional().default(false),
  priority: z.number().int().min(0).optional().default(0),
});

export const applyPromotionSchema = z.object({
  code: z.string().min(1).max(50),
  subtotal: z.number().min(0),
  customerId: z.string().uuid().optional(),
});
