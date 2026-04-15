import { z } from "zod";

export const unitSchema = z.object({
  name: z.string().min(1, "Unit name is required").max(100, "Unit name too long"),
  abbreviation: z.string().min(1, "Abbreviation is required").max(20, "Abbreviation too long"),
});
