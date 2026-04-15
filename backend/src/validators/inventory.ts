import { z } from "zod";

export const adjustStockSchema = z.object({
  variantId: z.string().uuid(),
  branchId: z.string().uuid(),
  quantity: z.number().int(),
  type: z.enum(["in", "out", "adjustment", "transfer", "return"]),
  notes: z.string().optional(),
  referenceType: z.string().optional(),
  referenceId: z.string().uuid().optional(),
});

export const setStockSchema = z.object({
  variantId: z.string().uuid(),
  branchId: z.string().uuid(),
  quantity: z.number().int().min(0),
  reorderPoint: z.number().int().min(0).optional(),
});

export const transferSchema = z.object({
  variantId: z.string().uuid(),
  fromBranchId: z.string().uuid(),
  toBranchId: z.string().uuid(),
  quantity: z.number().int().min(1),
  notes: z.string().optional(),
});
