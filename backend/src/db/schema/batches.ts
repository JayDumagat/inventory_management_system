import { pgTable, uuid, text, timestamp, integer, date } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { tenants } from "./tenants";
import { productVariants } from "./inventory";
import { branches } from "./branches";
import { users } from "./users";

export const productBatches = pgTable("product_batches", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  variantId: uuid("variant_id").notNull().references(() => productVariants.id, { onDelete: "cascade" }),
  branchId: uuid("branch_id").notNull().references(() => branches.id, { onDelete: "cascade" }),
  batchNumber: text("batch_number").notNull(),
  quantity: integer("quantity").notNull().default(0),
  expiryDate: date("expiry_date"),
  manufacturingDate: date("manufacturing_date"),
  notes: text("notes"),
  createdBy: uuid("created_by").references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const productBatchesRelations = relations(productBatches, ({ one }) => ({
  variant: one(productVariants, { fields: [productBatches.variantId], references: [productVariants.id] }),
  branch: one(branches, { fields: [productBatches.branchId], references: [branches.id] }),
  tenant: one(tenants, { fields: [productBatches.tenantId], references: [tenants.id] }),
}));
