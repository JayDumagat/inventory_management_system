import { z } from "zod";

export const productSchema = z.object({
  name: z.string().min(1, "Product name is required").max(200, "Product name too long"),
  description: z.string().max(2000, "Description too long").optional(),
  categoryId: z.string().uuid("Invalid category").optional().nullable(),
  unitId: z.string().uuid("Invalid unit").optional().nullable(),
  imageUrl: z.string().url("Invalid image URL").optional().nullable(),
  type: z.enum(["physical", "digital", "service", "bundle"], { message: "Invalid product type" }).optional().default("physical"),
  trackStock: z.boolean().optional(),
  currency: z.string().length(3, "Currency must be a 3-letter ISO 4217 code").transform((v) => v.toUpperCase()).optional().default("USD"),
});

export const variantSchema = z.object({
  name: z.string().min(1, "Variant name is required").max(200, "Variant name too long"),
  sku: z.string().min(1, "SKU is required").max(100, "SKU too long"),
  barcode: z.string().max(100, "Barcode too long").optional().nullable(),
  price: z.string().or(z.number()).refine(
    (val) => !isNaN(Number(val)) && Number(val) >= 0,
    { message: "Price must be a non-negative number" }
  ),
  costPrice: z.string().or(z.number()).optional().refine(
    (val) => val === undefined || val === "" || (!isNaN(Number(val)) && Number(val) >= 0),
    { message: "Cost price must be a non-negative number" }
  ),
  attributes: z.record(z.string(), z.unknown()).optional(),
  imageUrl: z.string().url("Invalid image URL").optional().nullable(),
});

export const attributeSchema = z.object({
  name: z.string().min(1, "Attribute name is required").max(100, "Attribute name too long"),
  sortOrder: z.number().int().min(0).optional(),
  options: z.array(z.object({ value: z.string().min(1, "Option value is required").max(100, "Option value too long"), sortOrder: z.number().int().min(0).optional() })).optional(),
});

export const updateAttributeSchema = z.object({
  name: z.string().min(1, "Attribute name is required").max(100, "Attribute name too long").optional(),
  sortOrder: z.number().int().min(0).optional(),
});

export const attributeOptionSchema = z.object({
  value: z.string().min(1, "Option value is required").max(100, "Option value too long"),
  sortOrder: z.number().int().min(0).optional(),
});
