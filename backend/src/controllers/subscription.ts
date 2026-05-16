import { Request, Response } from "express";
import { db } from "../db";
import {
  tenantSubscriptions, subscriptionAddons, subscriptionHistory, tenants, loyaltyConfig, invoices, invoiceItems,
} from "../db/schema";
import { eq, and, desc } from "drizzle-orm";
import { createAuditLog } from "../services/audit";
import { handleControllerError } from "../utils/errors";
import { changePlanSchema, addAddonSchema, removeAddonSchema } from "../validators/subscription";
import { getPlanDef, getLimit, hasFeature, PLAN_DEFINITIONS, PlanKey } from "../lib/planConfig";
import { getCount } from "../lib/usageCounter";
import { getCatalogPlan, listCatalogPlans, updateCatalogPlan } from "../lib/planCatalog";
import { generateInvoiceNumber } from "../utils/helpers";
import { sendPlatformEmail } from "../services/platformEmail";
import { ensurePlatformStripeReady } from "../services/platformPayment";

function addMonths(date: Date, months: number): Date {
  const copy = new Date(date);
  copy.setMonth(copy.getMonth() + months);
  return copy;
}

function getNextBillingDate(planKey: string): Date | null {
  const plan = getPlanDef(planKey);
  if (plan.monthlyPrice <= 0) return null;
  return addMonths(new Date(), 1);
}

async function createAndEmailSubscriptionInvoice(input: {
  tenantId: string;
  userId: string;
  userEmail: string;
  planKey: string;
}) {
  const plan = getPlanDef(input.planKey);
  if (plan.monthlyPrice <= 0) return { invoiceId: null, emailSent: false, emailError: null };

  const [tenant] = await db.select({ name: tenants.name }).from(tenants).where(eq(tenants.id, input.tenantId)).limit(1);
  const invoiceNumber = await generateInvoiceNumber(input.tenantId);

  const [invoice] = await db.insert(invoices).values({
    tenantId: input.tenantId,
    invoiceNumber,
    customerName: tenant?.name ?? "Tenant account",
    customerEmail: input.userEmail,
    subtotal: String(plan.monthlyPrice),
    taxAmount: "0",
    discountAmount: "0",
    totalAmount: String(plan.monthlyPrice),
    notes: `Subscription charge for ${plan.name} plan`,
    dueDate: getNextBillingDate(input.planKey)?.toISOString().slice(0, 10),
    createdBy: input.userId,
    status: "sent",
  }).returning();

  await db.insert(invoiceItems).values({
    invoiceId: invoice.id,
    description: `${plan.name} subscription (monthly)`,
    quantity: 1,
    unitPrice: String(plan.monthlyPrice),
    totalPrice: String(plan.monthlyPrice),
  });

  const emailResult = await sendPlatformEmail({
    to: input.userEmail,
    subject: `Subscription invoice ${invoice.invoiceNumber}`,
    text: `Hi,\n\nYour subscription has been updated to ${plan.name}.\nInvoice: ${invoice.invoiceNumber}\nAmount: $${plan.monthlyPrice.toFixed(2)}\n\nThank you.`,
  });

  return {
    invoiceId: invoice.id,
    emailSent: emailResult.sent,
    emailError: emailResult.sent ? null : emailResult.reason ?? "Email delivery failed",
  };
}

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
      const planDef = (await getCatalogPlan(created.planKey)) ?? getPlanDef(created.planKey);
      res.json({ subscription: created, plan: planDef, addons: [], usage: {} });
      return;
    }

    const planDef = (await getCatalogPlan(sub.planKey)) ?? getPlanDef(sub.planKey);
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
      const newPlanDef = (await getCatalogPlan(body.planKey)) ?? getPlanDef(body.planKey);
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

    const nextBillingDate = body.scheduleForPeriodEnd ? sub.currentPeriodEnd : getNextBillingDate(body.planKey);
    const targetPlanKey = body.scheduleForPeriodEnd ? sub.planKey : body.planKey;

    const paidPlan = !body.scheduleForPeriodEnd && ((await getCatalogPlan(body.planKey)) ?? getPlanDef(body.planKey)).monthlyPrice > 0;
    if (paidPlan) {
      const stripeCheck = await ensurePlatformStripeReady();
      if (!stripeCheck.ok) {
        res.status(402).json({ error: stripeCheck.error ?? "Stripe is not configured" });
        return;
      }
    }

    // Apply the plan change
    const [updated] = await db.update(tenantSubscriptions)
      .set({
        planKey: targetPlanKey,
        cancelAtPeriodEnd: body.scheduleForPeriodEnd,
        ...(body.scheduleForPeriodEnd ? {} : { currentPeriodStart: new Date() }),
        currentPeriodEnd: nextBillingDate,
        updatedAt: new Date(),
      })
      .where(eq(tenantSubscriptions.tenantId, tenantId))
      .returning();

    // Keep tenants.plan in sync for backward compatibility + loyalty disable on downgrade
    await db.transaction(async (tx) => {
      await tx.update(tenants)
        .set({
          plan: targetPlanKey,
          planExpiresAt: nextBillingDate,
          updatedAt: new Date(),
        })
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

    const invoiceResult = await createAndEmailSubscriptionInvoice({
      tenantId,
      userId: req.user!.id,
      userEmail: req.user!.email,
      planKey: updated.planKey,
    });

    res.json({
      subscription: updated,
      plan: (await getCatalogPlan(updated.planKey)) ?? getPlanDef(updated.planKey),
      billing: {
        nextBillingDate: updated.currentPeriodEnd,
      },
      invoice: invoiceResult,
    });
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
  try {
    const plans = await listCatalogPlans();
    res.json(plans);
  } catch (error) {
    handleControllerError(error, res);
  }
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

    const hasStaticPlan = Object.prototype.hasOwnProperty.call(PLAN_DEFINITIONS, planKey);
    const existing = hasStaticPlan
      ? PLAN_DEFINITIONS[planKey as PlanKey]
      : null;

    if (!existing && !(await getCatalogPlan(planKey))) {
      res.status(404).json({ error: "Plan not found" });
      return;
    }

    const updated = await updateCatalogPlan(planKey, { name, monthlyPrice, annualPrice, features, limits });
    res.json(updated ?? existing ?? (await getCatalogPlan(planKey)));
  } catch (error) {
    handleControllerError(error, res);
  }
}
