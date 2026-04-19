import { pgTable, uuid, text, timestamp, boolean, decimal, integer, jsonb } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { subscriptionStatusEnum } from "./enums";
import { tenants } from "./tenants";
import { users } from "./users";

// ─── Plan catalog (read-only reference rows seeded via migration) ─────────────
export const planCatalog = pgTable("plan_catalog", {
  id: uuid("id").primaryKey().defaultRandom(),
  key: text("key").notNull().unique(), // "free" | "pro" | "enterprise"
  name: text("name").notNull(),
  monthlyPrice: decimal("monthly_price", { precision: 10, scale: 2 }).notNull().default("0"),
  annualPrice: decimal("annual_price", { precision: 10, scale: 2 }).notNull().default("0"),
  // JSON: { branches: 1, products: 100, api_keys: 0, invoices_per_month: 0 }
  limits: jsonb("limits").$type<Record<string, number>>().notNull().default({}),
  // JSON array of feature keys
  features: jsonb("features").$type<string[]>().notNull().default([]),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ─── Active subscription per tenant ──────────────────────────────────────────
export const tenantSubscriptions = pgTable("tenant_subscriptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().unique().references(() => tenants.id, { onDelete: "cascade" }),
  planKey: text("plan_key").notNull().default("free"),
  status: subscriptionStatusEnum("status").notNull().default("active"),
  currentPeriodStart: timestamp("current_period_start").notNull().defaultNow(),
  currentPeriodEnd: timestamp("current_period_end"),
  cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
  trialEndsAt: timestamp("trial_ends_at"),
  // extra limits granted through add-ons: merged on top of plan limits
  addonLimits: jsonb("addon_limits").$type<Record<string, number>>().notNull().default({}),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ─── Active add-ons ───────────────────────────────────────────────────────────
export const subscriptionAddons = pgTable("subscription_addons", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  addonKey: text("addon_key").notNull(), // e.g. "extra_branches_5"
  quantity: integer("quantity").notNull().default(1),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ─── Subscription change history ─────────────────────────────────────────────
export const subscriptionHistory = pgTable("subscription_history", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  fromPlan: text("from_plan").notNull(),
  toPlan: text("to_plan").notNull(),
  reason: text("reason"),
  changedBy: uuid("changed_by").references(() => users.id),
  effectiveAt: timestamp("effective_at").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ─── Relations ────────────────────────────────────────────────────────────────
export const tenantSubscriptionsRelations = relations(tenantSubscriptions, ({ one }) => ({
  tenant: one(tenants, { fields: [tenantSubscriptions.tenantId], references: [tenants.id] }),
}));

export const subscriptionAddonsRelations = relations(subscriptionAddons, ({ one }) => ({
  tenant: one(tenants, { fields: [subscriptionAddons.tenantId], references: [tenants.id] }),
}));

export const subscriptionHistoryRelations = relations(subscriptionHistory, ({ one }) => ({
  tenant: one(tenants, { fields: [subscriptionHistory.tenantId], references: [tenants.id] }),
  changedByUser: one(users, { fields: [subscriptionHistory.changedBy], references: [users.id] }),
}));
