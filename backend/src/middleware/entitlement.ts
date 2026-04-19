import { Request, Response, NextFunction } from "express";
import { db } from "../db";
import { tenantSubscriptions } from "../db/schema";
import { eq } from "drizzle-orm";
import { getPlanDef, getLimit } from "../lib/planConfig";
import { getCount } from "../lib/usageCounter";
import type { PlanLimits } from "../lib/planConfig";

/** Attach subscription info to req.tenantContext (called from requireTenant). */
export async function attachSubscription(
  tenantId: string,
  ctx: { planKey?: string; addonLimits?: Record<string, number> },
): Promise<void> {
  try {
    const [sub] = await db
      .select({
        planKey: tenantSubscriptions.planKey,
        addonLimits: tenantSubscriptions.addonLimits,
        status: tenantSubscriptions.status,
      })
      .from(tenantSubscriptions)
      .where(eq(tenantSubscriptions.tenantId, tenantId));

    if (sub) {
      ctx.planKey = sub.planKey;
      ctx.addonLimits = (sub.addonLimits ?? {}) as Record<string, number>;
    } else {
      ctx.planKey = "free";
      ctx.addonLimits = {};
    }
  } catch {
    ctx.planKey = "free";
    ctx.addonLimits = {};
  }
}

/**
 * Middleware: verify that the tenant's plan includes a given feature.
 * Responds 402 if the feature is not part of the plan.
 */
export function requireFeature(feature: string) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const planKey = req.tenantContext?.planKey ?? "free";
    const def = getPlanDef(planKey);
    if (def.features.includes(feature)) {
      next();
      return;
    }
    res.status(402).json({
      error: "Feature not available on your current plan",
      feature,
      currentPlan: planKey,
      upgradeRequired: true,
    });
  };
}

/**
 * Middleware: verify that adding one more of `resource` does not exceed the
 * plan limit (+ add-on limit). Responds 402 if over quota.
 */
export function requireQuota(resource: keyof PlanLimits) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = req.tenantContext?.tenantId;
      if (!tenantId) { next(); return; }

      const planKey = req.tenantContext?.planKey ?? "free";
      const addonLimits = (req.tenantContext?.addonLimits ?? {}) as Record<string, number>;
      const limit = getLimit(planKey, resource, addonLimits);

      // -1 = unlimited
      if (limit === -1) { next(); return; }

      const current = await getCount(tenantId, resource as Parameters<typeof getCount>[1]);
      if (current >= limit) {
        res.status(402).json({
          error: `You have reached the ${resource} limit for your plan (${limit})`,
          resource,
          currentCount: current,
          limit,
          currentPlan: planKey,
          upgradeRequired: true,
        });
        return;
      }
      next();
    } catch {
      // On error, allow the request rather than blocking
      next();
    }
  };
}
