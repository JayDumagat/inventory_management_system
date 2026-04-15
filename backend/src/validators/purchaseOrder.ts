import { z } from "zod";

export const purchaseOrderItemSchema = z.object({
  variantId: z.string().uuid().optional(),
  productName: z.string().min(1),
  variantName: z.string().min(1),
  sku: z.string().min(1),
  quantity: z.number().int().min(1),
  unitCost: z.number().min(0),
});

export const createPurchaseOrderSchema = z.object({
  supplierId: z.string().uuid().optional(),
  branchId: z.string().uuid().optional(),
  notes: z.string().optional(),
  taxAmount: z.number().min(0).optional(),
  expectedDate: z.string().optional(),
  items: z.array(purchaseOrderItemSchema).min(1, "At least one item required"),
});

export const updatePurchaseOrderSchema = z.object({
  supplierId: z.string().uuid().optional().nullable(),
  branchId: z.string().uuid().optional().nullable(),
  notes: z.string().optional(),
  taxAmount: z.number().min(0).optional(),
  expectedDate: z.string().optional().nullable(),
  status: z.enum(["draft", "ordered", "partial", "received", "cancelled"]).optional(),
});
