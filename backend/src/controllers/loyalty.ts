import { Request, Response } from "express";
import { db } from "../db";
import { loyaltyConfig, loyaltyLedger, customers } from "../db/schema";
import { eq, and, desc } from "drizzle-orm";
import { createAuditLog } from "../services/audit";
import { handleControllerError } from "../utils/errors";
import { loyaltyConfigSchema, adjustPointsSchema, redeemPointsSchema } from "../validators/loyalty";

// ─── Get or initialise loyalty config ────────────────────────────────────────
export async function getConfig(req: Request, res: Response): Promise<void> {
  try {
    const tenantId = req.tenantContext!.tenantId;
    let [config] = await db.select().from(loyaltyConfig)
      .where(eq(loyaltyConfig.tenantId, tenantId));

    if (!config) {
      [config] = await db.insert(loyaltyConfig).values({ tenantId }).returning();
    }

    res.json(config);
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
}

// ─── Update loyalty config ────────────────────────────────────────────────────
export async function updateConfig(req: Request, res: Response): Promise<void> {
  try {
    const body = loyaltyConfigSchema.parse(req.body);
    const tenantId = req.tenantContext!.tenantId;

    // Upsert
    const existing = await db.select({ id: loyaltyConfig.id }).from(loyaltyConfig)
      .where(eq(loyaltyConfig.tenantId, tenantId));

    let config;
    if (existing.length === 0) {
      [config] = await db.insert(loyaltyConfig).values({
        tenantId,
        isEnabled: body.isEnabled,
        pointsPerDollar: body.pointsPerDollar !== undefined ? String(body.pointsPerDollar) : "1",
        pointsPerRedemptionDollar: body.pointsPerRedemptionDollar !== undefined ? String(body.pointsPerRedemptionDollar) : "100",
        minimumPointsToRedeem: body.minimumPointsToRedeem ?? 100,
        maximumRedeemPercent: body.maximumRedeemPercent ?? 50,
        pointsExpireDays: body.pointsExpireDays ?? undefined,
        programName: body.programName ?? "Loyalty Rewards",
        pointsLabel: body.pointsLabel ?? "points",
      }).returning();
    } else {
      const updateData: Record<string, unknown> = { updatedAt: new Date() };
      updateData.isEnabled = body.isEnabled;
      if (body.pointsPerDollar !== undefined) updateData.pointsPerDollar = String(body.pointsPerDollar);
      if (body.pointsPerRedemptionDollar !== undefined) updateData.pointsPerRedemptionDollar = String(body.pointsPerRedemptionDollar);
      if (body.minimumPointsToRedeem !== undefined) updateData.minimumPointsToRedeem = body.minimumPointsToRedeem;
      if (body.maximumRedeemPercent !== undefined) updateData.maximumRedeemPercent = body.maximumRedeemPercent;
      if (body.pointsExpireDays !== undefined) updateData.pointsExpireDays = body.pointsExpireDays;
      if (body.programName !== undefined) updateData.programName = body.programName;
      if (body.pointsLabel !== undefined) updateData.pointsLabel = body.pointsLabel;
      [config] = await db.update(loyaltyConfig)
        .set(updateData)
        .where(eq(loyaltyConfig.tenantId, tenantId))
        .returning();
    }

    await createAuditLog({
      tenantId,
      userId: req.user!.id,
      action: "update",
      resourceType: "loyalty_config",
      newValues: body as Record<string, unknown>,
    });

    res.json(config);
  } catch (error) {
    handleControllerError(error, res);
  }
}

// ─── Get customer loyalty balance + history ───────────────────────────────────
export async function getCustomerLoyalty(req: Request, res: Response): Promise<void> {
  try {
    const tenantId = req.tenantContext!.tenantId;
    const customerId = req.params.customerId as string;

    const [customer] = await db.select().from(customers)
      .where(and(eq(customers.id, customerId), eq(customers.tenantId, tenantId)));

    if (!customer) {
      res.status(404).json({ error: "Customer not found" });
      return;
    }

    const ledger = await db.select().from(loyaltyLedger)
      .where(and(
        eq(loyaltyLedger.tenantId, tenantId),
        eq(loyaltyLedger.customerId, customerId),
      ))
      .orderBy(desc(loyaltyLedger.createdAt))
      .limit(50);

    res.json({
      customerId,
      customerName: customer.name,
      balance: customer.loyaltyPoints,
      ledger,
    });
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
}

// ─── Manual point adjustment (manager+) ──────────────────────────────────────
export async function adjustPoints(req: Request, res: Response): Promise<void> {
  try {
    const body = adjustPointsSchema.parse(req.body);
    const tenantId = req.tenantContext!.tenantId;

    const [customer] = await db.select().from(customers)
      .where(and(eq(customers.id, body.customerId), eq(customers.tenantId, tenantId)));

    if (!customer) {
      res.status(404).json({ error: "Customer not found" });
      return;
    }

    const newBalance = Math.max(0, customer.loyaltyPoints + body.points);

    await db.update(customers)
      .set({ loyaltyPoints: newBalance, updatedAt: new Date() })
      .where(eq(customers.id, customer.id));

    const [entry] = await db.insert(loyaltyLedger).values({
      tenantId,
      customerId: body.customerId,
      type: "adjust",
      points: body.points,
      balanceBefore: customer.loyaltyPoints,
      balanceAfter: newBalance,
      notes: body.notes ?? "Manual adjustment",
      createdBy: req.user!.id,
    }).returning();

    await createAuditLog({
      tenantId,
      userId: req.user!.id,
      action: "update",
      resourceType: "loyalty_points",
      resourceId: body.customerId,
      newValues: { points: body.points, newBalance },
    });

    res.json({ balance: newBalance, entry });
  } catch (error) {
    handleControllerError(error, res);
  }
}

// ─── Validate / preview a points redemption ───────────────────────────────────
export async function previewRedemption(req: Request, res: Response): Promise<void> {
  try {
    const body = redeemPointsSchema.parse(req.body);
    const tenantId = req.tenantContext!.tenantId;

    const [config] = await db.select().from(loyaltyConfig)
      .where(eq(loyaltyConfig.tenantId, tenantId));

    if (!config || !config.isEnabled) {
      res.status(400).json({ error: "Loyalty program is not enabled" });
      return;
    }

    const [customer] = await db.select().from(customers)
      .where(and(eq(customers.id, body.customerId), eq(customers.tenantId, tenantId)));

    if (!customer) {
      res.status(404).json({ error: "Customer not found" });
      return;
    }

    if (customer.loyaltyPoints < config.minimumPointsToRedeem) {
      res.status(400).json({
        error: `Minimum ${config.minimumPointsToRedeem} points required to redeem`,
        balance: customer.loyaltyPoints,
        minimumRequired: config.minimumPointsToRedeem,
      });
      return;
    }

    if (body.points > customer.loyaltyPoints) {
      res.status(400).json({
        error: "Insufficient points",
        balance: customer.loyaltyPoints,
        requested: body.points,
      });
      return;
    }

    const pointsPerDollar = Number(config.pointsPerRedemptionDollar);
    const discountAmount = body.points / pointsPerDollar;

    // Cap at maximumRedeemPercent of subtotal
    const maxDiscount = body.subtotal * (config.maximumRedeemPercent / 100);
    const finalDiscount = Math.min(discountAmount, maxDiscount, body.subtotal);
    const pointsToUse = Math.floor(finalDiscount * pointsPerDollar);

    res.json({
      valid: true,
      pointsToRedeem: pointsToUse,
      discountAmount: Math.round(finalDiscount * 100) / 100,
      remainingBalance: customer.loyaltyPoints - pointsToUse,
    });
  } catch (error) {
    handleControllerError(error, res);
  }
}

// ─── Top customers by points ──────────────────────────────────────────────────
export async function getTopCustomers(req: Request, res: Response): Promise<void> {
  try {
    const tenantId = req.tenantContext!.tenantId;
    const list = await db.select({
      id: customers.id,
      name: customers.name,
      email: customers.email,
      loyaltyPoints: customers.loyaltyPoints,
    })
      .from(customers)
      .where(eq(customers.tenantId, tenantId))
      .orderBy(desc(customers.loyaltyPoints))
      .limit(20);

    res.json(list);
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
}
