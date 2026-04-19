import { z } from "zod";

export const orderItemSchema = z.object({
  variantId: z.string().uuid("Invalid variant ID"),
  productName: z.string().min(1, "Product name is required"),
  variantName: z.string().min(1, "Variant name is required"),
  sku: z.string().min(1, "SKU is required"),
  quantity: z.number().int("Quantity must be a whole number").min(1, "Quantity must be at least 1"),
  unitPrice: z.number().min(0, "Unit price cannot be negative"),
});

export const createOrderSchema = z.object({
  branchId: z.string().uuid("Invalid branch"),
  customerName: z.string().max(200, "Customer name too long").optional(),
  customerEmail: z.string().email("Invalid email").optional().or(z.literal("")),
  customerPhone: z.string().max(50, "Phone too long").optional(),
  customerId: z.string().uuid("Invalid customer ID").optional(),
  items: z.array(orderItemSchema).min(1, "At least one item is required"),
  taxAmount: z.number().min(0, "Tax amount cannot be negative").optional().default(0),
  discountAmount: z.number().min(0, "Discount amount cannot be negative").optional().default(0),
  notes: z.string().max(2000, "Notes too long").optional(),
  paymentMethod: z.string().max(50, "Payment method too long").optional(),
  status: z.enum(["draft", "confirmed", "processing", "shipped", "delivered", "cancelled", "refunded"], { message: "Invalid order status" }).optional(),
  // Promotion
  promotionId: z.string().uuid().optional(),
  promotionCode: z.string().max(50).optional(),
  // Loyalty redemption
  loyaltyPointsRedeemed: z.number().int().min(0).optional().default(0),
  loyaltyDiscountAmount: z.number().min(0).optional().default(0),
});

export const updateOrderSchema = z.object({
  status: z.enum(["draft", "confirmed", "processing", "shipped", "delivered", "cancelled", "refunded"], { message: "Invalid order status" }).optional(),
  notes: z.string().max(2000, "Notes too long").optional(),
});

export const refundSchema = z.object({
  amount: z.number().min(0.01, "Refund amount must be at least 0.01"),
  reason: z.string().max(2000, "Reason too long").optional(),
});
