import { z } from "zod";

export const productSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  categoryId: z.string().uuid().optional().nullable(),
  unitId: z.string().uuid().optional().nullable(),
  imageUrl: z.string().url().optional().nullable(),
  type: z.enum(["physical", "digital", "service", "bundle"]).optional().default("physical"),
});

export const variantSchema = z.object({
  name: z.string().min(1),
  sku: z.string().min(1),
  barcode: z.string().optional().nullable(),
  price: z.string().or(z.number()),
  costPrice: z.string().or(z.number()).optional(),
  attributes: z.record(z.string(), z.unknown()).optional(),
  imageUrl: z.string().url().optional().nullable(),
});

export const attributeSchema = z.object({
  name: z.string().min(1),
  sortOrder: z.number().int().optional(),
  options: z.array(z.object({ value: z.string().min(1), sortOrder: z.number().int().optional() })).optional(),
});

export const updateAttributeSchema = z.object({
  name: z.string().min(1).optional(),
  sortOrder: z.number().int().optional(),
});

export const attributeOptionSchema = z.object({
  value: z.string().min(1),
  sortOrder: z.number().int().optional(),
});
