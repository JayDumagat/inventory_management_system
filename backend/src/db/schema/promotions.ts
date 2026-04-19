import { pgTable, uuid, text, timestamp, boolean, decimal, integer, jsonb } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { promotionTypeEnum, promotionDiscountTypeEnum } from "./enums";
import { tenants } from "./tenants";
import { users } from "./users";
import { salesOrders } from "./orders";
import { customers } from "./customers";

// ─── Promotion definition ─────────────────────────────────────────────────────
export const promotions = pgTable("promotions", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  code: text("code"), // optional coupon code; null = auto-applied
  type: promotionTypeEnum("type").notNull(),
  discountType: promotionDiscountTypeEnum("discount_type").notNull(),
  discountValue: decimal("discount_value", { precision: 10, scale: 2 }).notNull(),
  minimumOrderAmount: decimal("minimum_order_amount", { precision: 10, scale: 2 }),
  maximumDiscountAmount: decimal("maximum_discount_amount", { precision: 10, scale: 2 }),
  // For BOGO / tiered promotions
  buyQuantity: integer("buy_quantity"),
  getQuantity: integer("get_quantity"),
  // Scope: "order" | "category"
  scope: text("scope").notNull().default("order"),
  // JSON array of category IDs (for category-scope promotions)
  applicableCategoryIds: jsonb("applicable_category_ids").$type<string[]>().default([]),
  // "all" | "new_customer" | "specific_customer"
  eligibility: text("eligibility").notNull().default("all"),
  specificCustomerId: uuid("specific_customer_id").references(() => customers.id, { onDelete: "set null" }),
  usageLimitTotal: integer("usage_limit_total"),
  usageLimitPerCustomer: integer("usage_limit_per_customer"),
  usageCount: integer("usage_count").notNull().default(0),
  startsAt: timestamp("starts_at"),
  endsAt: timestamp("ends_at"),
  isActive: boolean("is_active").notNull().default(true),
  stackable: boolean("stackable").notNull().default(false),
  priority: integer("priority").notNull().default(0),
  createdBy: uuid("created_by").references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ─── Usage log – one row per order that applied the promotion ─────────────────
export const promotionUsage = pgTable("promotion_usage", {
  id: uuid("id").primaryKey().defaultRandom(),
  promotionId: uuid("promotion_id").notNull().references(() => promotions.id, { onDelete: "cascade" }),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  orderId: uuid("order_id").references(() => salesOrders.id, { onDelete: "set null" }),
  customerId: uuid("customer_id").references(() => customers.id, { onDelete: "set null" }),
  discountApplied: decimal("discount_applied", { precision: 10, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ─── Relations ────────────────────────────────────────────────────────────────
export const promotionsRelations = relations(promotions, ({ one, many }) => ({
  tenant: one(tenants, { fields: [promotions.tenantId], references: [tenants.id] }),
  createdByUser: one(users, { fields: [promotions.createdBy], references: [users.id] }),
  specificCustomer: one(customers, { fields: [promotions.specificCustomerId], references: [customers.id] }),
  usages: many(promotionUsage),
}));

export const promotionUsageRelations = relations(promotionUsage, ({ one }) => ({
  promotion: one(promotions, { fields: [promotionUsage.promotionId], references: [promotions.id] }),
  order: one(salesOrders, { fields: [promotionUsage.orderId], references: [salesOrders.id] }),
  customer: one(customers, { fields: [promotionUsage.customerId], references: [customers.id] }),
}));
