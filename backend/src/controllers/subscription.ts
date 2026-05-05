import { Request, Response } from "express";
import { db } from "../db";
import {
  tenantSubscriptions, subscriptionAddons, subscriptionHistory, tenants, loyaltyConfig,
} from "../db/schema";
import { eq, and, desc } from "drizzle-orm";
import { createAuditLog } from "../services/audit";
import { handleControllerError } from "../utils/errors";
import { changePlanSchema, addAddonSchema, removeAddonSchema } from "../validators/subscription";
import { getPlanDef, getLimit, hasFeature, PLAN_DEFINITIONS } from "../lib/planConfig";
import { getCount } from "../lib/usageCounter";

// ─── Get current subscription ─────────────────────────────────────────────────
export async function getSubscription(req: Request, res: Response): Promise<void> {
  try {
    const tenantId = req.tenantContext!.tenantId;

    // Ensure subscription record exists (backfill for old tenants)
    const [sub] = await db.select().from(tenantSubscriptions)
      .where(eq(tenantSubscriptions.tenantId, tenantId));

    if (!sub) {
      const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId));
      const [created] = await db.insert(tenantSubscriptions).values({
        tenantId,
        planKey: tenant?.plan ?? "free",
        status: "active",
      }).returning();
      const planDef = getPlanDef(created.planKey);
      res.json({ subscription: created, plan: planDef, addons: [], usage: {} });
      return;
    }

    const planDef = getPlanDef(sub.planKey);
    const addons = await db.select().from(subscriptionAddons)
      .where(eq(subscriptionAddons.tenantId, tenantId));

    // Compute current usage for all metered resources
    const [branches, products, apiKeyCount, invoices] = await Promise.all([
      getCount(tenantId, "branches"),
      getCount(tenantId, "products"),
      getCount(tenantId, "api_keys"),
      getCount(tenantId, "invoices_per_month"),
    ]);

    const addonLimits = (sub.addonLimits ?? {}) as Record<string, number>;

    const usage = {
      branches: {
        current: branches,
        limit: getLimit(sub.planKey, "branches", addonLimits),
      },
      products: {
        current: products,
        limit: getLimit(sub.planKey, "products", addonLimits),
      },
      api_keys: {
        current: apiKeyCount,
        limit: getLimit(sub.planKey, "api_keys", addonLimits),
      },
      invoices_per_month: {
        current: invoices,
        limit: getLimit(sub.planKey, "invoices_per_month", addonLimits),
      },
    };

    res.json({ subscription: sub, plan: planDef, addons, usage });
  } catch (error) {
    handleControllerError(error, res);
  }
}

// ─── Upgrade / downgrade plan ─────────────────────────────────────────────────
export async function changePlan(req: Request, res: Response): Promise<void> {
  try {
    const body = changePlanSchema.parse(req.body);
    const tenantId = req.tenantContext!.tenantId;
    const role = req.tenantContext!.role;

    if (!["owner", "admin"].includes(role)) {
      res.status(403).json({ error: "Only owner or admin can change the plan" });
      return;
    }

    // Get or create subscription
    let [sub] = await db.select().from(tenantSubscriptions)
      .where(eq(tenantSubscriptions.tenantId, tenantId));

    if (!sub) {
      const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId));
      [sub] = await db.insert(tenantSubscriptions).values({
        tenantId,
        planKey: tenant?.plan ?? "free",
        status: "active",
      }).returning();
    }

    const fromPlan = sub.planKey;
    if (fromPlan === body.planKey) {
      res.status(400).json({ error: "Already on this plan" });
      return;
    }

    // Downgrade validation: check current usage won't exceed new plan limits
    if (!body.scheduleForPeriodEnd) {
      const newPlanDef = getPlanDef(body.planKey);
      const addonLimits = (sub.addonLimits ?? {}) as Record<string, number>;

      for (const [resource, limit] of Object.entries(newPlanDef.limits) as [string, number][]) {
        if (limit === -1) continue;
        const current = await getCount(tenantId, resource as Parameters<typeof getCount>[1]);
        const effective = limit + (addonLimits[resource] ?? 0);
        if (current > effective) {
          res.status(400).json({
            error: `Cannot downgrade: current ${resource} count (${current}) exceeds the ${body.planKey} plan limit (${effective}). Please reduce your ${resource} first.`,
            resource,
            currentCount: current,
            newLimit: effective,
          });
          return;
        }
      }
    }

    // Apply the plan change
    const [updated] = await db.update(tenantSubscriptions)
      .set({
        planKey: body.scheduleForPeriodEnd ? sub.planKey : body.planKey,
        cancelAtPeriodEnd: body.scheduleForPeriodEnd,
        updatedAt: new Date(),
      })
      .where(eq(tenantSubscriptions.tenantId, tenantId))
      .returning();

    // Keep tenants.plan in sync for backward compatibility + loyalty disable on downgrade
    await db.transaction(async (tx) => {
      await tx.update(tenants)
        .set({ plan: body.scheduleForPeriodEnd ? fromPlan : body.planKey, updatedAt: new Date() })
        .where(eq(tenants.id, tenantId));

      if (!body.scheduleForPeriodEnd && !hasFeature(body.planKey, "loyalty")) {
        await tx.update(loyaltyConfig)
          .set({ isEnabled: false, updatedAt: new Date() })
          .where(eq(loyaltyConfig.tenantId, tenantId));
      }
    });

    // Record history
    await db.insert(subscriptionHistory).values({
      tenantId,
      fromPlan,
      toPlan: body.planKey,
      reason: body.scheduleForPeriodEnd
        ? `Scheduled downgrade to ${body.planKey} at period end`
        : `Immediate change to ${body.planKey}`,
      changedBy: req.user!.id,
    });

    await createAuditLog({
      tenantId,
      userId: req.user!.id,
      action: "update",
      resourceType: "subscription",
      resourceId: updated.id,
      newValues: { planKey: body.planKey, scheduleForPeriodEnd: body.scheduleForPeriodEnd },
    });

    res.json({ subscription: updated, plan: getPlanDef(updated.planKey) });
  } catch (error) {
    handleControllerError(error, res);
  }
}

// ─── Get subscription change history ─────────────────────────────────────────
export async function getHistory(req: Request, res: Response): Promise<void> {
  try {
    const tenantId = req.tenantContext!.tenantId;
    const history = await db.select().from(subscriptionHistory)
      .where(eq(subscriptionHistory.tenantId, tenantId))
      .orderBy(desc(subscriptionHistory.createdAt))
      .limit(50);
    res.json(history);
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
}

// ─── Add add-on ───────────────────────────────────────────────────────────────
export async function addAddon(req: Request, res: Response): Promise<void> {
  try {
    const body = addAddonSchema.parse(req.body);
    const tenantId = req.tenantContext!.tenantId;

    if (!["owner", "admin"].includes(req.tenantContext!.role)) {
      res.status(403).json({ error: "Only owner or admin can manage add-ons" });
      return;
    }

    // Determine how much limit this addon adds
    // Convention: addonKey format = "extra_branches_5" => +5 branches
    const addonLimitMap: Record<string, Record<string, number>> = {
      extra_branches_1: { branches: 1 },
      extra_branches_5: { branches: 5 },
      extra_products_500: { products: 500 },
      extra_invoices_100: { invoices_per_month: 100 },
      extra_api_keys_5: { api_keys: 5 },
    };

    if (!addonLimitMap[body.addonKey]) {
      res.status(400).json({ error: "Unknown add-on key", availableAddons: Object.keys(addonLimitMap) });
      return;
    }

    // Upsert in addon_limits on the subscription
    const [sub] = await db.select().from(tenantSubscriptions)
      .where(eq(tenantSubscriptions.tenantId, tenantId));

    const existing = (sub?.addonLimits ?? {}) as Record<string, number>;
    const contribution = addonLimitMap[body.addonKey];
    const updated: Record<string, number> = { ...existing };
    for (const [k, v] of Object.entries(contribution)) {
      updated[k] = (updated[k] ?? 0) + v * body.quantity;
    }

    await db.update(tenantSubscriptions)
      .set({ addonLimits: updated, updatedAt: new Date() })
      .where(eq(tenantSubscriptions.tenantId, tenantId));

    // Track addon row
    await db.insert(subscriptionAddons).values({
      tenantId,
      addonKey: body.addonKey,
      quantity: body.quantity,
    });

    await createAuditLog({
      tenantId,
      userId: req.user!.id,
      action: "create",
      resourceType: "subscription_addon",
      newValues: { addonKey: body.addonKey, quantity: body.quantity },
    });

    res.status(201).json({ addonKey: body.addonKey, quantity: body.quantity, newLimits: updated });
  } catch (error) {
    handleControllerError(error, res);
  }
}

// ─── Remove add-on ────────────────────────────────────────────────────────────
export async function removeAddon(req: Request, res: Response): Promise<void> {
  try {
    const body = removeAddonSchema.parse(req.body);
    const tenantId = req.tenantContext!.tenantId;

    if (!["owner", "admin"].includes(req.tenantContext!.role)) {
      res.status(403).json({ error: "Only owner or admin can manage add-ons" });
      return;
    }

    // Remove the most recently added instance
    const [addon] = await db.select().from(subscriptionAddons)
      .where(and(
        eq(subscriptionAddons.tenantId, tenantId),
        eq(subscriptionAddons.addonKey, body.addonKey),
      ));

    if (!addon) {
      res.status(404).json({ error: "Add-on not found" });
      return;
    }

    await db.delete(subscriptionAddons).where(eq(subscriptionAddons.id, addon.id));

    await createAuditLog({
      tenantId,
      userId: req.user!.id,
      action: "delete",
      resourceType: "subscription_addon",
      newValues: { addonKey: body.addonKey },
    });

    res.json({ message: "Add-on removed" });
  } catch (error) {
    handleControllerError(error, res);
  }
}

// ─── List available plans ─────────────────────────────────────────────────────
export async function listPlans(_req: Request, res: Response): Promise<void> {
  res.json(Object.values(PLAN_DEFINITIONS));
}

// ─── Superadmin: update a plan definition (in-memory override) ───────────────
export async function updatePlanDefinition(req: Request, res: Response): Promise<void> {
  try {
    const planKey = req.params.planKey as string;
    const { name, monthlyPrice, annualPrice, features, limits } = req.body as {
      name?: string;
      monthlyPrice?: number;
      annualPrice?: number;
      features?: string[];
      limits?: Record<string, number>;
    };

    const existing = PLAN_DEFINITIONS[planKey as keyof typeof PLAN_DEFINITIONS];
    if (!existing) {
      res.status(404).json({ error: "Plan not found" });
      return;
    }

    if (name !== undefined) existing.name = name;
    if (monthlyPrice !== undefined) existing.monthlyPrice = monthlyPrice;
    if (annualPrice !== undefined) existing.annualPrice = annualPrice;
    if (Array.isArray(features)) existing.features = features;
    if (limits !== undefined) Object.assign(existing.limits, limits);

    res.json(existing);
  } catch (error) {
    handleControllerError(error, res);
  }
}
