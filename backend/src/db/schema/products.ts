import { pgTable, uuid, text, timestamp, boolean, decimal, jsonb, integer } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { productTypeEnum } from "./enums";
import { tenants } from "./tenants";
import { categories } from "./categories";
import { units } from "./units";
import { productVariants } from "./inventory";
import { productImages } from "./productImages";

export const products = pgTable("products", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  categoryId: uuid("category_id").references(() => categories.id, { onDelete: "set null" }),
  unitId: uuid("unit_id").references(() => units.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  description: text("description"),
  type: productTypeEnum("type").notNull().default("physical"),
  trackStock: boolean("track_stock").notNull().default(true),
  imageUrl: text("image_url"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const productAttributes = pgTable("product_attributes", {
  id: uuid("id").primaryKey().defaultRandom(),
  productId: uuid("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const productAttributeOptions = pgTable("product_attribute_options", {
  id: uuid("id").primaryKey().defaultRandom(),
  attributeId: uuid("attribute_id").notNull().references(() => productAttributes.id, { onDelete: "cascade" }),
  value: text("value").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const productsRelations = relations(products, ({ one, many }) => ({
  tenant: one(tenants, { fields: [products.tenantId], references: [tenants.id] }),
  category: one(categories, { fields: [products.categoryId], references: [categories.id] }),
  unit: one(units, { fields: [products.unitId], references: [units.id] }),
  variants: many(productVariants),
  attributes: many(productAttributes),
  images: many(productImages),
}));

export const productAttributesRelations = relations(productAttributes, ({ one, many }) => ({
  product: one(products, { fields: [productAttributes.productId], references: [products.id] }),
  options: many(productAttributeOptions),
}));

export const productAttributeOptionsRelations = relations(productAttributeOptions, ({ one }) => ({
  attribute: one(productAttributes, { fields: [productAttributeOptions.attributeId], references: [productAttributes.id] }),
}));
