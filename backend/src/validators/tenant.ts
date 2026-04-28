import { z } from "zod";

const httpUrlSchema = z.string().url().refine(
  (value) => value.startsWith("http://") || value.startsWith("https://"),
  "URL must start with http:// or https://"
);

export const createTenantSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/, "Slug must be lowercase alphanumeric with dashes"),
  description: z.string().optional(),
  taxRate: z.number().min(0).max(100).optional(),
  logoUrl: z.string().url().optional().or(z.literal("")),
  receiptTemplate: z.enum(["compact", "detailed"]).optional(),
  receiptFooterMessage: z.string().max(200).optional(),
  receiptLogoUrl: httpUrlSchema.optional().or(z.literal("")),
  receiptShowLogo: z.boolean().optional(),
});

export const updateTenantSchema = createTenantSchema.partial().extend({
  plan: z.enum(["free", "pro", "enterprise"]).optional(),
});
