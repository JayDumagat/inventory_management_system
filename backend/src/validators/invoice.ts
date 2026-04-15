import { z } from "zod";

export const invoiceItemSchema = z.object({
  description: z.string().min(1),
  quantity: z.number().int().min(1).default(1),
  unitPrice: z.number().min(0),
  totalPrice: z.number().min(0),
});

export const invoiceSchema = z.object({
  orderId: z.string().uuid().optional().nullable(),
  branchId: z.string().uuid().optional().nullable(),
  customerName: z.string().optional().nullable(),
  customerEmail: z.string().email().optional().nullable().or(z.literal("")),
  customerPhone: z.string().optional().nullable(),
  customerAddress: z.string().optional().nullable(),
  taxAmount: z.number().min(0).optional().default(0),
  discountAmount: z.number().min(0).optional().default(0),
  notes: z.string().optional().nullable(),
  dueDate: z.string().optional().nullable(),
  items: z.array(invoiceItemSchema).min(1, "At least one item required"),
});

export const updateInvoiceSchema = z.object({
  status: z.enum(["draft", "sent", "paid", "overdue", "cancelled"]).optional(),
  notes: z.string().optional().nullable(),
  dueDate: z.string().optional().nullable(),
  customerName: z.string().optional().nullable(),
  customerEmail: z.string().email().optional().nullable(),
});
