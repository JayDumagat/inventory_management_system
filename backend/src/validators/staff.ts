import { z } from "zod";

export const inviteStaffSchema = z.object({
  email: z.string().email(),
  role: z.enum(["staff", "manager", "admin"]).default("staff"),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  password: z.string().min(8).max(128).optional(),
});

export const updateStaffSchema = z.object({
  role: z.enum(["staff", "manager", "admin"]).optional(),
  isActive: z.boolean().optional(),
  allowedPages: z.array(z.string()).optional(),
  expiresAt: z.string().datetime().nullable().optional(),
});

export const assignBranchSchema = z.object({
  branchId: z.string().uuid(),
});
