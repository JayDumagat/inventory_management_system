import { pgTable, uuid, text, timestamp, boolean, jsonb, decimal } from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { tenantUserRoleEnum } from "./enums";
import { users } from "./users";
import { branches } from "./branches";
import { categories } from "./categories";
import { products } from "./products";
import { salesOrders } from "./orders";
import { units } from "./units";
import { suppliers } from "./suppliers";
import { purchaseOrders } from "./purchaseOrders";
import { transactions } from "./transactions";
import { integrations } from "./integrations";
import { apiKeys } from "./apiKeys";
import { invoices } from "./invoices";
import { tenantSubscriptions } from "./subscriptions";

export const tenants = pgTable("tenants", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  logoUrl: text("logo_url"),
  receiptTemplate: text("receipt_template").notNull().default("compact"),
  receiptFooterMessage: text("receipt_footer_message").notNull().default("Thank you for your purchase!"),
  receiptLogoUrl: text("receipt_logo_url"),
  receiptShowLogo: boolean("receipt_show_logo").notNull().default(false),
  taxRate: decimal("tax_rate", { precision: 5, scale: 2 }).notNull().default("0"),
  plan: text("plan").notNull().default("free"),
  planExpiresAt: timestamp("plan_expires_at"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const tenantUsers = pgTable("tenant_users", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  role: tenantUserRoleEnum("role").notNull().default("staff"),
  isActive: boolean("is_active").notNull().default(true),
  allowedPages: jsonb("allowed_pages").$type<string[]>().default(sql`'[]'::jsonb`),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const branchStaff = pgTable("branch_staff", {
  id: uuid("id").primaryKey().defaultRandom(),
  branchId: uuid("branch_id").notNull().references(() => branches.id, { onDelete: "cascade" }),
  tenantUserId: uuid("tenant_user_id").notNull().references(() => tenantUsers.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const tenantsRelations = relations(tenants, ({ many, one }) => ({
  tenantUsers: many(tenantUsers),
  branches: many(branches),
  categories: many(categories),
  products: many(products),
  salesOrders: many(salesOrders),
  units: many(units),
  suppliers: many(suppliers),
  purchaseOrders: many(purchaseOrders),
  transactions: many(transactions),
  integrations: many(integrations),
  apiKeys: many(apiKeys),
  invoices: many(invoices),
  subscription: one(tenantSubscriptions, { fields: [tenants.id], references: [tenantSubscriptions.tenantId] }),
}));

export const tenantUsersRelations = relations(tenantUsers, ({ one }) => ({
  tenant: one(tenants, { fields: [tenantUsers.tenantId], references: [tenants.id] }),
  user: one(users, { fields: [tenantUsers.userId], references: [users.id] }),
}));

export const branchStaffRelations = relations(branchStaff, ({ one }) => ({
  branch: one(branches, { fields: [branchStaff.branchId], references: [branches.id] }),
  tenantUser: one(tenantUsers, { fields: [branchStaff.tenantUserId], references: [tenantUsers.id] }),
}));
