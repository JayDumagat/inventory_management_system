// Centralised plan feature/limit definitions.
// -1 means "unlimited".

export type PlanKey = "free" | "pro" | "enterprise";

export interface PlanLimits {
  branches: number;
  products: number;
  api_keys: number;
  invoices_per_month: number;
}

export interface PlanDefinition {
  key: PlanKey;
  name: string;
  monthlyPrice: number;
  annualPrice: number;
  features: string[];
  limits: PlanLimits;
}

export const PLAN_DEFINITIONS: Record<PlanKey, PlanDefinition> = {
  free: {
    key: "free",
    name: "Free",
    monthlyPrice: 0,
    annualPrice: 0,
    features: [
      "pos", "products", "inventory", "sales_orders", "categories",
      "units", "customers", "audit_log", "reports_basic", "dashboard",
    ],
    limits: { branches: 1, products: 100, api_keys: 0, invoices_per_month: 0 },
  },
  pro: {
    key: "pro",
    name: "Pro",
    monthlyPrice: 29,
    annualPrice: 290,
    features: [
      "pos", "products", "inventory", "sales_orders", "categories", "units",
      "customers", "audit_log", "reports_basic", "reports_advanced", "analytics",
      "invoices", "api_keys", "integrations", "purchase_orders", "suppliers",
      "batches", "dashboard", "promotions", "loyalty", "receipt_design",
    ],
    limits: { branches: 5, products: -1, api_keys: 10, invoices_per_month: 100 },
  },
  enterprise: {
    key: "enterprise",
    name: "Enterprise",
    monthlyPrice: 99,
    annualPrice: 990,
    features: [
      "pos", "products", "inventory", "sales_orders", "categories", "units",
      "customers", "audit_log", "reports_basic", "reports_advanced", "analytics",
      "invoices", "api_keys", "integrations", "purchase_orders", "suppliers",
      "batches", "dashboard", "white_label", "custom_integrations", "sla",
      "promotions", "loyalty", "receipt_design",
    ],
    limits: { branches: -1, products: -1, api_keys: -1, invoices_per_month: -1 },
  },
};

export function getPlanDef(planKey: string): PlanDefinition {
  return PLAN_DEFINITIONS[(planKey as PlanKey)] ?? PLAN_DEFINITIONS.free;
}

export function hasFeature(planKey: string, feature: string): boolean {
  return getPlanDef(planKey).features.includes(feature);
}

export function getLimit(
  planKey: string,
  resource: keyof PlanLimits,
  addonLimits: Record<string, number> = {},
): number {
  const base = getPlanDef(planKey).limits[resource];
  const addon = addonLimits[resource] ?? 0;
  if (base === -1) return -1; // unlimited
  return base + addon;
}
