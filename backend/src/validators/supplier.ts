import { z } from "zod";

export const supplierSchema = z.object({
  name: z.string().min(1, "Supplier name is required").max(200, "Supplier name too long"),
  contactName: z.string().max(200, "Contact name too long").optional(),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  phone: z.string().max(50, "Phone too long").optional(),
  website: z.string().url("Invalid website URL").optional().or(z.literal("")),
  address: z.string().max(500, "Address too long").optional(),
  city: z.string().max(100, "City too long").optional(),
  country: z.string().max(100, "Country too long").optional(),
  notes: z.string().max(2000, "Notes too long").optional(),
  isActive: z.boolean().optional(),
});
