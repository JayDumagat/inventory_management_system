import { z } from "zod";

export const batchSchema = z.object({
  variantId: z.string().uuid("Invalid variant"),
  branchId: z.string().uuid("Invalid branch"),
  batchNumber: z.string().min(1, "Batch number is required").max(100, "Batch number too long"),
  quantity: z.number().int("Quantity must be a whole number").min(0, "Quantity cannot be negative"),
  expiryDate: z.string().optional().nullable(),
  manufacturingDate: z.string().optional().nullable(),
  notes: z.string().max(2000, "Notes too long").optional().nullable(),
});
