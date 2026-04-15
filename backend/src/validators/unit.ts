import { z } from "zod";

export const unitSchema = z.object({
  name: z.string().min(1),
  abbreviation: z.string().min(1),
});
