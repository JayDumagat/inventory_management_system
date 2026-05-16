import { db } from "../db";
import { planCatalog } from "../db/schema";
import { eq, asc } from "drizzle-orm";
import { PLAN_DEFINITIONS, PlanDefinition, PlanKey } from "./planConfig";

type PartialPlanUpdate = {
  name?: string;
  monthlyPrice?: number;
  annualPrice?: number;
  features?: string[];
  limits?: Record<string, number>;
};

function toPlanDefinition(row: typeof planCatalog.$inferSelect): PlanDefinition {
  const limits = (row.limits ?? {}) as Record<string, number>;
  return {
    key: row.key as PlanKey,
    name: row.name,
    monthlyPrice: Number(row.monthlyPrice),
    annualPrice: Number(row.annualPrice),
    features: Array.isArray(row.features) ? row.features : [],
    limits: limits as unknown as PlanDefinition["limits"],
  };
}

function defaultCatalogRows() {
  return Object.values(PLAN_DEFINITIONS).map((p) => ({
    key: p.key,
    name: p.name,
    monthlyPrice: String(p.monthlyPrice),
    annualPrice: String(p.annualPrice),
    features: p.features,
    limits: { ...p.limits } as Record<string, number>,
    isActive: true,
  }));
}

function syncInMemoryDefinitions(plans: PlanDefinition[]) {
  for (const plan of plans) {
    const existing = PLAN_DEFINITIONS[plan.key as PlanKey];
    if (!existing) continue;
    existing.name = plan.name;
    existing.monthlyPrice = plan.monthlyPrice;
    existing.annualPrice = plan.annualPrice;
    existing.features = plan.features;
    existing.limits = plan.limits;
  }
}

export async function ensurePlanCatalogSeeded(): Promise<void> {
  const existing = await db.select({ id: planCatalog.id }).from(planCatalog).limit(1);
  if (existing.length > 0) return;
  await db.insert(planCatalog).values(defaultCatalogRows());
}

export async function listCatalogPlans(): Promise<PlanDefinition[]> {
  await ensurePlanCatalogSeeded();
  const rows = await db.select().from(planCatalog).where(eq(planCatalog.isActive, true)).orderBy(asc(planCatalog.monthlyPrice));
  const plans = rows.map(toPlanDefinition);
  syncInMemoryDefinitions(plans);
  return plans;
}

export async function getCatalogPlan(planKey: string): Promise<PlanDefinition | null> {
  await ensurePlanCatalogSeeded();
  const [row] = await db.select().from(planCatalog).where(eq(planCatalog.key, planKey)).limit(1);
  if (!row) return null;
  const mapped = toPlanDefinition(row);
  syncInMemoryDefinitions([mapped]);
  return mapped;
}

export async function updateCatalogPlan(planKey: string, update: PartialPlanUpdate): Promise<PlanDefinition | null> {
  await ensurePlanCatalogSeeded();
  const [existing] = await db.select().from(planCatalog).where(eq(planCatalog.key, planKey)).limit(1);
  if (!existing) return null;

  const mergedLimits = {
    ...((existing.limits ?? {}) as Record<string, number>),
    ...(update.limits ?? {}),
  };

  const [saved] = await db.update(planCatalog).set({
    ...(update.name !== undefined && { name: update.name }),
    ...(update.monthlyPrice !== undefined && { monthlyPrice: String(update.monthlyPrice) }),
    ...(update.annualPrice !== undefined && { annualPrice: String(update.annualPrice) }),
    ...(update.features !== undefined && { features: update.features }),
    ...(update.limits !== undefined && { limits: mergedLimits }),
    updatedAt: new Date(),
  }).where(eq(planCatalog.key, planKey)).returning();

  const mapped = toPlanDefinition(saved);
  syncInMemoryDefinitions([mapped]);
  return mapped;
}
