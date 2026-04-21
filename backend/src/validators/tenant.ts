import { z } from "zod";

export const createTenantSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/, "Slug must be lowercase alphanumeric with dashes"),
  description: z.string().optional(),
  logoUrl: z.string().url().optional().or(z.literal("")),
  receiptTemplate: z.enum(["compact", "detailed"]).optional(),
  receiptFooterMessage: z.string().max(200).optional(),
});

export const updateTenantSchema = createTenantSchema.partial().extend({
  plan: z.enum(["free", "pro", "enterprise"]).optional(),
});
