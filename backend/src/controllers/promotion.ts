import { Request, Response } from "express";
import { db } from "../db";
import { promotions, promotionUsage, customers } from "../db/schema";
import { eq, and, desc, or, isNull, lte, gte } from "drizzle-orm";
import { createAuditLog } from "../services/audit";
import { handleControllerError } from "../utils/errors";
import { promotionSchema, applyPromotionSchema } from "../validators/promotion";

// ─── List promotions ──────────────────────────────────────────────────────────
export async function listPromotions(req: Request, res: Response): Promise<void> {
  try {
    const tenantId = req.tenantContext!.tenantId;
    const list = await db.select().from(promotions)
      .where(eq(promotions.tenantId, tenantId))
      .orderBy(desc(promotions.createdAt));
    res.json(list);
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
}

// ─── Create promotion ─────────────────────────────────────────────────────────
export async function createPromotion(req: Request, res: Response): Promise<void> {
  try {
    const body = promotionSchema.parse(req.body);
    const tenantId = req.tenantContext!.tenantId;

    // Unique code check within the tenant
    if (body.code) {
      const [existing] = await db.select({ id: promotions.id }).from(promotions)
        .where(and(eq(promotions.tenantId, tenantId), eq(promotions.code, body.code)));
      if (existing) {
        res.status(409).json({ error: "A promotion with this code already exists" });
        return;
      }
    }

    const [promo] = await db.insert(promotions).values({
      ...body,
      tenantId,
      discountValue: String(body.discountValue),
      minimumOrderAmount: body.minimumOrderAmount !== undefined ? String(body.minimumOrderAmount) : undefined,
      maximumDiscountAmount: body.maximumDiscountAmount !== undefined ? String(body.maximumDiscountAmount) : undefined,
      startsAt: body.startsAt ? new Date(body.startsAt) : undefined,
      endsAt: body.endsAt ? new Date(body.endsAt) : undefined,
      createdBy: req.user!.id,
    }).returning();

    await createAuditLog({
      tenantId,
      userId: req.user!.id,
      action: "create",
      resourceType: "promotion",
      resourceId: promo.id,
    });

    res.status(201).json(promo);
  } catch (error) {
    handleControllerError(error, res);
  }
}

// ─── Get promotion ────────────────────────────────────────────────────────────
export async function getPromotion(req: Request, res: Response): Promise<void> {
  try {
    const [promo] = await db.select().from(promotions)
      .where(and(
        eq(promotions.id, req.params.promotionId as string),
        eq(promotions.tenantId, req.tenantContext!.tenantId),
      ));
    if (!promo) {
      res.status(404).json({ error: "Promotion not found" });
      return;
    }
    res.json(promo);
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
}

// ─── Update promotion ─────────────────────────────────────────────────────────
export async function updatePromotion(req: Request, res: Response): Promise<void> {
  try {
    const body = promotionSchema.partial().parse(req.body);
    const tenantId = req.tenantContext!.tenantId;

    // Unique code check on update
    if (body.code) {
      const [existing] = await db.select({ id: promotions.id }).from(promotions)
        .where(and(eq(promotions.tenantId, tenantId), eq(promotions.code, body.code)));
      if (existing && existing.id !== req.params.promotionId) {
        res.status(409).json({ error: "A promotion with this code already exists" });
        return;
      }
    }

    const updateData: Record<string, unknown> = { ...body, updatedAt: new Date() };
    if (body.discountValue !== undefined) updateData.discountValue = String(body.discountValue);
    if (body.minimumOrderAmount !== undefined) updateData.minimumOrderAmount = String(body.minimumOrderAmount);
    if (body.maximumDiscountAmount !== undefined) updateData.maximumDiscountAmount = String(body.maximumDiscountAmount);
    if (body.startsAt) updateData.startsAt = new Date(body.startsAt);
    if (body.endsAt) updateData.endsAt = new Date(body.endsAt);

    const [updated] = await db.update(promotions)
      .set(updateData)
      .where(and(
        eq(promotions.id, req.params.promotionId as string),
        eq(promotions.tenantId, tenantId),
      ))
      .returning();

    if (!updated) {
      res.status(404).json({ error: "Promotion not found" });
      return;
    }

    await createAuditLog({
      tenantId,
      userId: req.user!.id,
      action: "update",
      resourceType: "promotion",
      resourceId: updated.id,
    });

    res.json(updated);
  } catch (error) {
    handleControllerError(error, res);
  }
}

// ─── Delete promotion ─────────────────────────────────────────────────────────
export async function deletePromotion(req: Request, res: Response): Promise<void> {
  try {
    const tenantId = req.tenantContext!.tenantId;
    const [deleted] = await db.delete(promotions)
      .where(and(
        eq(promotions.id, req.params.promotionId as string),
        eq(promotions.tenantId, tenantId),
      ))
      .returning();

    if (!deleted) {
      res.status(404).json({ error: "Promotion not found" });
      return;
    }

    await createAuditLog({
      tenantId,
      userId: req.user!.id,
      action: "delete",
      resourceType: "promotion",
      resourceId: deleted.id,
    });

    res.json({ message: "Promotion deleted" });
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
}

// ─── Apply / validate a promotion code ───────────────────────────────────────
export async function applyPromotion(req: Request, res: Response): Promise<void> {
  try {
    const body = applyPromotionSchema.parse(req.body);
    const tenantId = req.tenantContext!.tenantId;
    const now = new Date();

    // Find the promotion by code
    const [promo] = await db.select().from(promotions)
      .where(and(
        eq(promotions.tenantId, tenantId),
        eq(promotions.code, body.code),
        eq(promotions.isActive, true),
      ));

    if (!promo) {
      res.status(404).json({ error: "Promotion code not found or inactive" });
      return;
    }

    // Date range check
    if (promo.startsAt && new Date(promo.startsAt) > now) {
      res.status(400).json({ error: "Promotion has not started yet" });
      return;
    }
    if (promo.endsAt && new Date(promo.endsAt) < now) {
      res.status(400).json({ error: "Promotion has expired" });
      return;
    }

    // Minimum order check
    if (promo.minimumOrderAmount && body.subtotal < Number(promo.minimumOrderAmount)) {
      res.status(400).json({
        error: `Minimum order amount of ${promo.minimumOrderAmount} required`,
        minimumOrderAmount: Number(promo.minimumOrderAmount),
      });
      return;
    }

    // Total usage limit check
    if (promo.usageLimitTotal !== null && promo.usageLimitTotal !== undefined) {
      if (promo.usageCount >= promo.usageLimitTotal) {
        res.status(400).json({ error: "Promotion usage limit reached" });
        return;
      }
    }

    // Per-customer usage limit check
    if (body.customerId && promo.usageLimitPerCustomer !== null && promo.usageLimitPerCustomer !== undefined) {
      const usages = await db.select({ id: promotionUsage.id }).from(promotionUsage)
        .where(and(
          eq(promotionUsage.promotionId, promo.id),
          eq(promotionUsage.customerId, body.customerId),
        ));
      if (usages.length >= promo.usageLimitPerCustomer) {
        res.status(400).json({ error: "You have already used this promotion the maximum number of times" });
        return;
      }
    }

    // Eligibility check
    if (promo.eligibility === "new_customer" && body.customerId) {
      // Check if customer has previous orders (usage of this tenant)
      const prevUsages = await db.select({ id: promotionUsage.id }).from(promotionUsage)
        .where(and(
          eq(promotionUsage.tenantId, tenantId),
          eq(promotionUsage.customerId, body.customerId),
        ));
      if (prevUsages.length > 0) {
        res.status(400).json({ error: "This promotion is for new customers only" });
        return;
      }
    }

    if (promo.eligibility === "specific_customer") {
      if (!body.customerId || body.customerId !== promo.specificCustomerId) {
        res.status(400).json({ error: "This promotion is not applicable to this customer" });
        return;
      }
    }

    // Calculate discount
    let discountAmount = 0;
    if (promo.discountType === "percentage") {
      discountAmount = body.subtotal * (Number(promo.discountValue) / 100);
    } else {
      discountAmount = Number(promo.discountValue);
    }

    // Apply maximum discount cap
    if (promo.maximumDiscountAmount) {
      discountAmount = Math.min(discountAmount, Number(promo.maximumDiscountAmount));
    }

    // Cannot exceed subtotal
    discountAmount = Math.min(discountAmount, body.subtotal);
    discountAmount = Math.round(discountAmount * 100) / 100;

    res.json({
      valid: true,
      promotionId: promo.id,
      promotionCode: promo.code,
      promotionName: promo.name,
      discountAmount,
      discountType: promo.discountType,
      discountValue: Number(promo.discountValue),
    });
  } catch (error) {
    handleControllerError(error, res);
  }
}

// ─── Get auto-applied promotions (no code required) ──────────────────────────
export async function getAutoPromotions(req: Request, res: Response): Promise<void> {
  try {
    const tenantId = req.tenantContext!.tenantId;
    const subtotal = typeof req.query.subtotal === "string" ? parseFloat(req.query.subtotal) : 0;
    const now = new Date();

    // Find active promotions with no code (auto-applied) valid right now
    const list = await db.select().from(promotions)
      .where(and(
        eq(promotions.tenantId, tenantId),
        eq(promotions.isActive, true),
        isNull(promotions.code),
        or(isNull(promotions.startsAt), lte(promotions.startsAt, now)),
        or(isNull(promotions.endsAt), gte(promotions.endsAt, now)),
      ))
      .orderBy(desc(promotions.priority));

    // Filter by minimum order amount
    const eligible = list.filter(p =>
      !p.minimumOrderAmount || subtotal >= Number(p.minimumOrderAmount)
    );

    res.json(eligible);
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
}

// ─── Get promotion usage stats ────────────────────────────────────────────────
export async function getPromotionUsage(req: Request, res: Response): Promise<void> {
  try {
    const tenantId = req.tenantContext!.tenantId;
    const promotionId = req.params.promotionId as string;

    const [promo] = await db.select().from(promotions)
      .where(and(eq(promotions.id, promotionId), eq(promotions.tenantId, tenantId)));

    if (!promo) {
      res.status(404).json({ error: "Promotion not found" });
      return;
    }

    const usages = await db
      .select({
        id: promotionUsage.id,
        orderId: promotionUsage.orderId,
        customerId: promotionUsage.customerId,
        discountApplied: promotionUsage.discountApplied,
        createdAt: promotionUsage.createdAt,
        customerName: customers.name,
      })
      .from(promotionUsage)
      .leftJoin(customers, eq(promotionUsage.customerId, customers.id))
      .where(eq(promotionUsage.promotionId, promotionId))
      .orderBy(desc(promotionUsage.createdAt))
      .limit(100);

    res.json({ promotion: promo, usages });
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
}
