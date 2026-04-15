import { z } from "zod";

export const createKeySchema = z.object({
  name: z.string().min(1),
  expiresAt: z.string().datetime().optional(),
});
