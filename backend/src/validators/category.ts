import { z } from "zod";

export const categorySchema = z.object({
  name: z.string().min(1, "Category name is required").max(200, "Category name too long"),
  description: z.string().max(1000, "Description too long").optional(),
  parentId: z.string().uuid("Invalid parent category").optional().nullable(),
});
