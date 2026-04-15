import { z } from "zod";

export const batchSchema = z.object({
  variantId: z.string().uuid(),
  branchId: z.string().uuid(),
  batchNumber: z.string().min(1),
  quantity: z.number().int().min(0),
  expiryDate: z.string().optional().nullable(),
  manufacturingDate: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});
