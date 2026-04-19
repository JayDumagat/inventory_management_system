import { z } from "zod";

export const loyaltyConfigSchema = z.object({
  isEnabled: z.boolean(),
  pointsPerDollar: z.number().min(0).optional(),
  pointsPerRedemptionDollar: z.number().min(1).optional(),
  minimumPointsToRedeem: z.number().int().min(1).optional(),
  maximumRedeemPercent: z.number().int().min(1).max(100).optional(),
  pointsExpireDays: z.number().int().min(1).nullable().optional(),
  programName: z.string().max(100).optional(),
  pointsLabel: z.string().max(50).optional(),
});

export const adjustPointsSchema = z.object({
  customerId: z.string().uuid(),
  points: z.number().int().min(-100000).max(100000),
  notes: z.string().max(500).optional(),
});

export const redeemPointsSchema = z.object({
  customerId: z.string().uuid(),
  points: z.number().int().min(1),
  subtotal: z.number().min(0),
});
