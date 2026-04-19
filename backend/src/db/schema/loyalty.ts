import { pgTable, uuid, text, timestamp, boolean, decimal, integer } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { loyaltyTxTypeEnum } from "./enums";
import { tenants } from "./tenants";
import { customers } from "./customers";
import { salesOrders } from "./orders";
import { users } from "./users";

// ─── Per-tenant loyalty program configuration ─────────────────────────────────
export const loyaltyConfig = pgTable("loyalty_config", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().unique().references(() => tenants.id, { onDelete: "cascade" }),
  isEnabled: boolean("is_enabled").notNull().default(false),
  // How many points the customer earns per whole dollar spent
  pointsPerDollar: decimal("points_per_dollar", { precision: 10, scale: 4 }).notNull().default("1"),
  // How many points are needed to redeem 1 dollar of discount
  pointsPerRedemptionDollar: decimal("points_per_redemption_dollar", { precision: 10, scale: 4 }).notNull().default("100"),
  // Minimum points balance required before redemption is allowed
  minimumPointsToRedeem: integer("minimum_points_to_redeem").notNull().default(100),
  // Maximum percentage of order total that can be covered by points (0-100; -1 = no cap)
  maximumRedeemPercent: integer("maximum_redeem_percent").notNull().default(50),
  // Days until unspent points expire (null = never)
  pointsExpireDays: integer("points_expire_days"),
  programName: text("program_name").notNull().default("Loyalty Rewards"),
  pointsLabel: text("points_label").notNull().default("points"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ─── Customer points ledger ───────────────────────────────────────────────────
export const loyaltyLedger = pgTable("loyalty_ledger", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  customerId: uuid("customer_id").notNull().references(() => customers.id, { onDelete: "cascade" }),
  orderId: uuid("order_id").references(() => salesOrders.id, { onDelete: "set null" }),
  type: loyaltyTxTypeEnum("type").notNull(),
  points: integer("points").notNull(), // positive = earn/adjust; negative = redeem/expire
  balanceBefore: integer("balance_before").notNull(),
  balanceAfter: integer("balance_after").notNull(),
  notes: text("notes"),
  expiresAt: timestamp("expires_at"), // null = does not expire
  createdBy: uuid("created_by").references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ─── Relations ────────────────────────────────────────────────────────────────
export const loyaltyConfigRelations = relations(loyaltyConfig, ({ one }) => ({
  tenant: one(tenants, { fields: [loyaltyConfig.tenantId], references: [tenants.id] }),
}));

export const loyaltyLedgerRelations = relations(loyaltyLedger, ({ one }) => ({
  tenant: one(tenants, { fields: [loyaltyLedger.tenantId], references: [tenants.id] }),
  customer: one(customers, { fields: [loyaltyLedger.customerId], references: [customers.id] }),
  order: one(salesOrders, { fields: [loyaltyLedger.orderId], references: [salesOrders.id] }),
  createdByUser: one(users, { fields: [loyaltyLedger.createdBy], references: [users.id] }),
}));
