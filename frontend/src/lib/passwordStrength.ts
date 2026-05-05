import { z } from "zod";

// Password strength rules aligned with DICT Cybersecurity Manual and NIST SP 800-63B
export const strongPasswordSchema = z.string()
  .min(8, "At least 8 characters")
  .refine((p) => /[A-Z]/.test(p), "Must contain an uppercase letter")
  .refine((p) => /[a-z]/.test(p), "Must contain a lowercase letter")
  .refine((p) => /[0-9]/.test(p), "Must contain a number")
  .refine((p) => /[^A-Za-z0-9]/.test(p), "Must contain a special character (!@#$%...)");

export interface PasswordRule {
  label: string;
  test: (p: string) => boolean;
}

export const PASSWORD_RULES: PasswordRule[] = [
  { label: "At least 8 characters", test: (p) => p.length >= 8 },
  { label: "One uppercase letter (A–Z)", test: (p) => /[A-Z]/.test(p) },
  { label: "One lowercase letter (a–z)", test: (p) => /[a-z]/.test(p) },
  { label: "One number (0–9)", test: (p) => /[0-9]/.test(p) },
  { label: "One special character (!@#$%...)", test: (p) => /[^A-Za-z0-9]/.test(p) },
];

export function getPasswordStrength(password: string): { score: number; label: string; color: string } {
  const passed = PASSWORD_RULES.filter((r) => r.test(password)).length;
  if (passed <= 1) return { score: 1, label: "Very weak", color: "bg-red-500" };
  if (passed === 2) return { score: 2, label: "Weak", color: "bg-orange-400" };
  if (passed === 3) return { score: 3, label: "Fair", color: "bg-yellow-400" };
  if (passed === 4) return { score: 4, label: "Good", color: "bg-blue-400" };
  return { score: 5, label: "Strong", color: "bg-green-500" };
}
