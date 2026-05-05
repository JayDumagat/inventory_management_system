import { z } from "zod";

export const customerSchema = z.object({
  name: z.string().min(1, "Name is required").max(200, "Name too long"),
  email: z.string().email("Invalid email").optional().or(z.literal("")).transform(v => v || undefined),
  phone: z.string().max(50, "Phone too long").optional().or(z.literal("")).transform(v => v || undefined),
  address: z.string().max(500, "Address too long").optional().or(z.literal("")).transform(v => v || undefined),
  city: z.string().max(100, "City too long").optional().or(z.literal("")).transform(v => v || undefined),
  country: z.string().max(100, "Country too long").optional().or(z.literal("")).transform(v => v || undefined),
  notes: z.string().max(2000, "Notes too long").optional().or(z.literal("")).transform(v => v || undefined),
  // NPC / Data Privacy Act of 2012 (RA 10173): explicit consent for collecting PII
  dataConsentGiven: z.boolean().optional(),
});

export const customerSearchSchema = z.object({
  q: z.string().optional(),
});
