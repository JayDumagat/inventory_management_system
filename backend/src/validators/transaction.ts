import { z } from "zod";

export const transactionSchema = z.object({
  type: z.enum(["sale", "purchase", "expense", "refund", "adjustment", "other"]),
  amount: z.number(),
  description: z.string().min(1),
  branchId: z.string().uuid().optional(),
  referenceType: z.string().optional(),
  referenceId: z.string().optional(),
  notes: z.string().optional(),
});
