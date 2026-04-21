import { Request, Response } from "express";
import { db } from "../db";
import {
  tenants, tenantUsers, tenantSubscriptions, subscriptionHistory, loyaltyConfig,
} from "../db/schema";
import { eq, desc, ilike, and, count, sql } from "drizzle-orm";
import { handleControllerError } from "../utils/errors";
import { createAuditLog } from "../services/audit";
import { z } from "zod";
import { hasFeature } from "../lib/planConfig";

// ─── List all tenants ─────────────────────────────────────────────────────────
export async function listAllTenants(req: Request, res: Response): Promise<void> {
  try {
    const search = typeof req.query.search === "string" ? req.query.search : undefined;
    const page = parseInt(typeof req.query.page === "string" ? req.query.page : "1", 10);
    const perPage = Math.min(
      parseInt(typeof req.query.perPage === "string" ? req.query.perPage : "25", 10),
      100,
    );
    const offset = (page - 1) * perPage;

    const conditions = search ? [ilike(tenants.name, `%${search}%`)] : [];

    const rows = await db
      .select({
        id: tenants.id,
        name: tenants.name,
        slug: tenants.slug,
        isActive: tenants.isActive,
        plan: tenants.plan,
        createdAt: tenants.createdAt,
      })
      .from(tenants)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(tenants.createdAt))
      .limit(perPage)
      .offset(offset);

    const [{ total }] = await db
      .select({ total: count() })
      .from(tenants)
      .where(conditions.length ? and(...conditions) : undefined);

    res.json({ tenants: rows, total, page, perPage });
  } catch (error) {
    handleControllerError(error, res);
  }
}

// ─── Get tenant detail ────────────────────────────────────────────────────────
export async function getTenantDetail(req: Request, res: Response): Promise<void> {
  try {
    const tenantId = req.params.tenantId as string;
    const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId));
    if (!tenant) {
      res.status(404).json({ error: "Tenant not found" });
      return;
    }

    const [sub] = await db
      .select()
      .from(tenantSubscriptions)
      .where(eq(tenantSubscriptions.tenantId, tenantId));

    const memberCount = await db
      .select({ total: count() })
      .from(tenantUsers)
      .where(eq(tenantUsers.tenantId, tenantId));

    res.json({ tenant, subscription: sub ?? null, memberCount: memberCount[0].total });
  } catch (error) {
    handleControllerError(error, res);
  }
}

// ─── Suspend / reactivate tenant ─────────────────────────────────────────────
export async function setTenantActive(req: Request, res: Response): Promise<void> {
  try {
    const tenantId = req.params.tenantId as string;
    const schema = z.object({ isActive: z.boolean() });
    const { isActive } = schema.parse(req.body);

    const [updated] = await db
      .update(tenants)
      .set({ isActive, updatedAt: new Date() })
      .where(eq(tenants.id, tenantId))
      .returning();

    if (!updated) {
      res.status(404).json({ error: "Tenant not found" });
      return;
    }

    await createAuditLog({
      userId: req.superadmin!.id,
      action: "update",
      resourceType: "tenant",
      resourceId: tenantId,
      newValues: { isActive },
    });

    res.json(updated);
  } catch (error) {
    handleControllerError(error, res);
  }
}

// ─── Override tenant subscription ────────────────────────────────────────────
export async function overrideTenantSubscription(req: Request, res: Response): Promise<void> {
  try {
    const tenantId = req.params.tenantId as string;
    const schema = z.object({
      planKey: z.string(),
      status: z.enum(["active", "trialing", "overdue", "canceled", "paused"]).optional(),
      currentPeriodEnd: z.string().optional(),
    });
    const body = schema.parse(req.body);

    const [tenant] = await db.select({ plan: tenants.plan }).from(tenants).where(eq(tenants.id, tenantId));
    if (!tenant) {
      res.status(404).json({ error: "Tenant not found" });
      return;
    }

    const [existing] = await db
      .select()
      .from(tenantSubscriptions)
      .where(eq(tenantSubscriptions.tenantId, tenantId));

    let updated;
    if (existing) {
      [updated] = await db
        .update(tenantSubscriptions)
        .set({
          planKey: body.planKey,
          ...(body.status && { status: body.status }),
          ...(body.currentPeriodEnd && { currentPeriodEnd: new Date(body.currentPeriodEnd) }),
          updatedAt: new Date(),
        })
        .where(eq(tenantSubscriptions.tenantId, tenantId))
        .returning();

      await db.insert(subscriptionHistory).values({
        tenantId,
        fromPlan: existing.planKey,
        toPlan: body.planKey,
        reason: `Overridden by superadmin (${req.superadmin!.email})`,
        changedBy: req.superadmin!.id,
      });
    } else {
      [updated] = await db
        .insert(tenantSubscriptions)
        .values({
          tenantId,
          planKey: body.planKey,
          status: body.status ?? "active",
          ...(body.currentPeriodEnd && { currentPeriodEnd: new Date(body.currentPeriodEnd) }),
        })
        .returning();
    }

    // Keep tenants.plan in sync + loyalty disable on non-loyalty plans
    await db.transaction(async (tx) => {
      await tx
        .update(tenants)
        .set({ plan: body.planKey, updatedAt: new Date() })
        .where(eq(tenants.id, tenantId));

      if (!hasFeature(body.planKey, "loyalty")) {
        await tx
          .update(loyaltyConfig)
          .set({ isEnabled: false, updatedAt: new Date() })
          .where(eq(loyaltyConfig.tenantId, tenantId));
      }
    });

    await createAuditLog({
      userId: req.superadmin!.id,
      action: "update",
      resourceType: "subscription",
      resourceId: tenantId,
      newValues: { planKey: body.planKey, status: body.status },
    });

    res.json(updated);
  } catch (error) {
    handleControllerError(error, res);
  }
}

// ─── Platform reports ─────────────────────────────────────────────────────────
export async function platformReports(req: Request, res: Response): Promise<void> {
  try {
    // Total tenants
    const [{ totalTenants }] = await db
      .select({ totalTenants: count() })
      .from(tenants);

    // Tenants by plan
    const byPlan = await db
      .select({ plan: tenants.plan, count: count() })
      .from(tenants)
      .where(eq(tenants.isActive, true))
      .groupBy(tenants.plan);

    // Monthly-equivalent revenue (simple calculation based on plan prices)
    const PLAN_MRR: Record<string, number> = { free: 0, pro: 29, enterprise: 99 };
    const mrr = byPlan.reduce((sum, row) => {
      return sum + (PLAN_MRR[row.plan] ?? 0) * Number(row.count);
    }, 0);

    // Subscriptions by status
    const byStatus = await db
      .select({ status: tenantSubscriptions.status, count: count() })
      .from(tenantSubscriptions)
      .groupBy(tenantSubscriptions.status);

    // New tenants last 30 days
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [{ newTenants }] = await db
      .select({ newTenants: count() })
      .from(tenants)
      .where(sql`${tenants.createdAt} >= ${thirtyDaysAgo}`);

    res.json({
      totalTenants,
      newTenantsLast30Days: Number(newTenants),
      mrr,
      arr: mrr * 12,
      byPlan,
      byStatus,
    });
  } catch (error) {
    handleControllerError(error, res);
  }
}
