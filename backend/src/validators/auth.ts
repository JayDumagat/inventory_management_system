import { z } from "zod";

// Password strength rules aligned with DICT Cybersecurity Manual and NIST SP 800-63B:
// - Minimum 8 characters
// - At least one uppercase letter
// - At least one lowercase letter
// - At least one digit
// - At least one special character
const strongPassword = z.string()
  .min(8, "Password must be at least 8 characters")
  .refine((p) => /[A-Z]/.test(p), "Password must contain at least one uppercase letter")
  .refine((p) => /[a-z]/.test(p), "Password must contain at least one lowercase letter")
  .refine((p) => /[0-9]/.test(p), "Password must contain at least one number")
  .refine((p) => /[^A-Za-z0-9]/.test(p), "Password must contain at least one special character");

export const registerSchema = z.object({
  email: z.string().email(),
  password: strongPassword,
  confirmPassword: z.string(),
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
}).refine(data => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: strongPassword,
  confirmPassword: z.string(),
}).refine(d => d.password === d.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

export const googleOAuthSchema = z.object({
  credential: z.string().min(1),
});
