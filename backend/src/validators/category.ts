import { z } from "zod";

export const categorySchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  parentId: z
      .string()
      .nullable()
      .optional()
      .transform((val) => (val === "" || val === undefined ? null : val)),
});
