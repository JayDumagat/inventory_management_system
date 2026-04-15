import { z } from "zod";

export const orderItemSchema = z.object({
  variantId: z.string().uuid(),
  productName: z.string(),
  variantName: z.string(),
  sku: z.string(),
  quantity: z.number().int().min(1),
  unitPrice: z.number().min(0),
});

export const createOrderSchema = z.object({
  branchId: z.string().uuid(),
  customerName: z.string().optional(),
  customerEmail: z.string().email().optional().or(z.literal("")),
  customerPhone: z.string().optional(),
  customerId: z.string().uuid().optional(),
  items: z.array(orderItemSchema).min(1, "At least one item is required"),
  taxAmount: z.number().min(0).optional().default(0),
  discountAmount: z.number().min(0).optional().default(0),
  notes: z.string().optional(),
  paymentMethod: z.string().optional(),
  status: z.enum(["draft", "confirmed", "processing", "shipped", "delivered", "cancelled", "refunded"]).optional(),
});

export const updateOrderSchema = z.object({
  status: z.enum(["draft", "confirmed", "processing", "shipped", "delivered", "cancelled", "refunded"]).optional(),
  notes: z.string().optional(),
});

export const refundSchema = z.object({
  amount: z.number().min(0.01),
  reason: z.string().optional(),
});
