import { pgTable, pgEnum, uuid, text, timestamp, integer, decimal, boolean, jsonb, date } from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";

// Enums
export const tenantUserRoleEnum = pgEnum("tenant_user_role", ["owner", "admin", "manager", "staff"]);
export const stockMovementTypeEnum = pgEnum("stock_movement_type", ["in", "out", "transfer", "adjustment", "return"]);
export const salesOrderStatusEnum = pgEnum("sales_order_status", ["draft", "confirmed", "processing", "shipped", "delivered", "cancelled", "refunded"]);
export const auditActionEnum = pgEnum("audit_action", ["create", "update", "delete", "login", "logout", "other"]);
export const purchaseOrderStatusEnum = pgEnum("purchase_order_status", ["draft", "ordered", "partial", "received", "cancelled"]);
export const transactionTypeEnum = pgEnum("transaction_type", ["sale", "purchase", "expense", "refund", "adjustment", "other"]);
export const productTypeEnum = pgEnum("product_type", ["physical", "digital", "service", "bundle"]);
export const invoiceStatusEnum = pgEnum("invoice_status", ["draft", "sent", "paid", "overdue", "cancelled"]);

// Users table (global, not tenant-scoped)
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash"),
  firstName: text("first_name").notNull().default(""),
  lastName: text("last_name").notNull().default(""),
  isActive: boolean("is_active").notNull().default(true),
  oauthProvider: text("oauth_provider"),
  oauthProviderId: text("oauth_provider_id"),
  passwordResetToken: text("password_reset_token"),
  passwordResetExpiry: timestamp("password_reset_expiry"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Tenants table
export const tenants = pgTable("tenants", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  logoUrl: text("logo_url"),
  plan: text("plan").notNull().default("free"),
  planExpiresAt: timestamp("plan_expires_at"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Tenant Users junction
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

// Branches
export const branches = pgTable("branches", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  address: text("address"),
  city: text("city"),
  country: text("country"),
  phone: text("phone"),
  isActive: boolean("is_active").notNull().default(true),
  isDefault: boolean("is_default").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Branch Staff Assignments
export const branchStaff = pgTable("branch_staff", {
  id: uuid("id").primaryKey().defaultRandom(),
  branchId: uuid("branch_id").notNull().references(() => branches.id, { onDelete: "cascade" }),
  tenantUserId: uuid("tenant_user_id").notNull().references(() => tenantUsers.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Units of Measurement
export const units = pgTable("units", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  abbreviation: text("abbreviation").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Categories
export const categories = pgTable("categories", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  parentId: uuid("parent_id"),
  name: text("name").notNull(),
  description: text("description"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Products
export const products = pgTable("products", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  categoryId: uuid("category_id").references(() => categories.id, { onDelete: "set null" }),
  unitId: uuid("unit_id").references(() => units.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  description: text("description"),
  type: productTypeEnum("type").notNull().default("physical"),
  imageUrl: text("image_url"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Product Variants
export const productVariants = pgTable("product_variants", {
  id: uuid("id").primaryKey().defaultRandom(),
  productId: uuid("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  sku: text("sku").notNull(),
  barcode: text("barcode"),
  price: decimal("price", { precision: 10, scale: 2 }).notNull().default("0"),
  costPrice: decimal("cost_price", { precision: 10, scale: 2 }).notNull().default("0"),
  attributes: jsonb("attributes").default({}),
  imageUrl: text("image_url"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Inventory (stock per variant per branch)
export const inventory = pgTable("inventory", {
  id: uuid("id").primaryKey().defaultRandom(),
  variantId: uuid("variant_id").notNull().references(() => productVariants.id, { onDelete: "cascade" }),
  branchId: uuid("branch_id").notNull().references(() => branches.id, { onDelete: "cascade" }),
  quantity: integer("quantity").notNull().default(0),
  reservedQuantity: integer("reserved_quantity").notNull().default(0),
  reorderPoint: integer("reorder_point").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Stock Movements
export const stockMovements = pgTable("stock_movements", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  variantId: uuid("variant_id").notNull().references(() => productVariants.id, { onDelete: "cascade" }),
  branchId: uuid("branch_id").notNull().references(() => branches.id, { onDelete: "cascade" }),
  destinationBranchId: uuid("destination_branch_id").references(() => branches.id, { onDelete: "set null" }),
  type: stockMovementTypeEnum("type").notNull(),
  quantity: integer("quantity").notNull(),
  previousQuantity: integer("previous_quantity").notNull().default(0),
  newQuantity: integer("new_quantity").notNull().default(0),
  referenceType: text("reference_type"),
  referenceId: uuid("reference_id"),
  notes: text("notes"),
  createdBy: uuid("created_by").references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Sales Orders
export const salesOrders = pgTable("sales_orders", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  branchId: uuid("branch_id").notNull().references(() => branches.id),
  orderNumber: text("order_number").notNull(),
  status: salesOrderStatusEnum("status").notNull().default("draft"),
  customerName: text("customer_name"),
  customerEmail: text("customer_email"),
  customerPhone: text("customer_phone"),
  subtotal: decimal("subtotal", { precision: 10, scale: 2 }).notNull().default("0"),
  taxAmount: decimal("tax_amount", { precision: 10, scale: 2 }).notNull().default("0"),
  discountAmount: decimal("discount_amount", { precision: 10, scale: 2 }).notNull().default("0"),
  totalAmount: decimal("total_amount", { precision: 10, scale: 2 }).notNull().default("0"),
  notes: text("notes"),
  createdBy: uuid("created_by").references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Sales Order Items
export const salesOrderItems = pgTable("sales_order_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderId: uuid("order_id").notNull().references(() => salesOrders.id, { onDelete: "cascade" }),
  variantId: uuid("variant_id").notNull().references(() => productVariants.id),
  productName: text("product_name").notNull(),
  variantName: text("variant_name").notNull(),
  sku: text("sku").notNull(),
  quantity: integer("quantity").notNull(),
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }).notNull(),
  totalPrice: decimal("total_price", { precision: 10, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Refunds
export const refunds = pgTable("refunds", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderId: uuid("order_id").notNull().references(() => salesOrders.id, { onDelete: "cascade" }),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  reason: text("reason"),
  status: text("status").notNull().default("pending"),
  processedBy: uuid("processed_by").references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Product Batches (batch/lot tracking with expiry)
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

// Product Attributes (e.g. Color, Size)
export const productAttributes = pgTable("product_attributes", {
  id: uuid("id").primaryKey().defaultRandom(),
  productId: uuid("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Product Attribute Options (e.g. Red, Blue / Small, Large)
export const productAttributeOptions = pgTable("product_attribute_options", {
  id: uuid("id").primaryKey().defaultRandom(),
  attributeId: uuid("attribute_id").notNull().references(() => productAttributes.id, { onDelete: "cascade" }),
  value: text("value").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Audit Logs
export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").references(() => tenants.id, { onDelete: "set null" }),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  action: auditActionEnum("action").notNull(),
  resourceType: text("resource_type").notNull(),
  resourceId: text("resource_id"),
  oldValues: jsonb("old_values"),
  newValues: jsonb("new_values"),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Suppliers
export const suppliers = pgTable("suppliers", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  contactName: text("contact_name"),
  email: text("email"),
  phone: text("phone"),
  website: text("website"),
  address: text("address"),
  city: text("city"),
  country: text("country"),
  notes: text("notes"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Purchase Orders
export const purchaseOrders = pgTable("purchase_orders", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  supplierId: uuid("supplier_id").references(() => suppliers.id, { onDelete: "set null" }),
  branchId: uuid("branch_id").references(() => branches.id, { onDelete: "set null" }),
  orderNumber: text("order_number").notNull(),
  status: purchaseOrderStatusEnum("status").notNull().default("draft"),
  notes: text("notes"),
  subtotal: decimal("subtotal", { precision: 10, scale: 2 }).notNull().default("0"),
  taxAmount: decimal("tax_amount", { precision: 10, scale: 2 }).notNull().default("0"),
  totalAmount: decimal("total_amount", { precision: 10, scale: 2 }).notNull().default("0"),
  expectedDate: date("expected_date"),
  receivedAt: timestamp("received_at"),
  createdBy: uuid("created_by").references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Purchase Order Items
export const purchaseOrderItems = pgTable("purchase_order_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  purchaseOrderId: uuid("purchase_order_id").notNull().references(() => purchaseOrders.id, { onDelete: "cascade" }),
  variantId: uuid("variant_id").references(() => productVariants.id, { onDelete: "set null" }),
  productName: text("product_name").notNull(),
  variantName: text("variant_name").notNull(),
  sku: text("sku").notNull(),
  quantity: integer("quantity").notNull(),
  receivedQuantity: integer("received_quantity").notNull().default(0),
  unitCost: decimal("unit_cost", { precision: 10, scale: 2 }).notNull(),
  totalCost: decimal("total_cost", { precision: 10, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Transactions
export const transactions = pgTable("transactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  branchId: uuid("branch_id").references(() => branches.id, { onDelete: "set null" }),
  type: transactionTypeEnum("type").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  description: text("description").notNull(),
  referenceType: text("reference_type"),
  referenceId: text("reference_id"),
  notes: text("notes"),
  createdBy: uuid("created_by").references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Integrations
export const integrations = pgTable("integrations", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  provider: text("provider").notNull(),
  isEnabled: boolean("is_enabled").notNull().default(false),
  config: jsonb("config").default({}),
  webhookUrl: text("webhook_url"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// API Keys
export const apiKeys = pgTable("api_keys", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  keyHash: text("key_hash").notNull(),
  keyPrefix: text("key_prefix").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  expiresAt: timestamp("expires_at"),
  lastUsedAt: timestamp("last_used_at"),
  createdBy: uuid("created_by").references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Invoices
export const invoices = pgTable("invoices", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  orderId: uuid("order_id").references(() => salesOrders.id, { onDelete: "set null" }),
  branchId: uuid("branch_id").references(() => branches.id, { onDelete: "set null" }),
  invoiceNumber: text("invoice_number").notNull(),
  status: invoiceStatusEnum("status").notNull().default("draft"),
  customerName: text("customer_name"),
  customerEmail: text("customer_email"),
  customerPhone: text("customer_phone"),
  customerAddress: text("customer_address"),
  subtotal: decimal("subtotal", { precision: 10, scale: 2 }).notNull().default("0"),
  taxAmount: decimal("tax_amount", { precision: 10, scale: 2 }).notNull().default("0"),
  discountAmount: decimal("discount_amount", { precision: 10, scale: 2 }).notNull().default("0"),
  totalAmount: decimal("total_amount", { precision: 10, scale: 2 }).notNull().default("0"),
  notes: text("notes"),
  dueDate: date("due_date"),
  paidAt: timestamp("paid_at"),
  createdBy: uuid("created_by").references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Invoice Items
export const invoiceItems = pgTable("invoice_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  invoiceId: uuid("invoice_id").notNull().references(() => invoices.id, { onDelete: "cascade" }),
  description: text("description").notNull(),
  quantity: integer("quantity").notNull().default(1),
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }).notNull(),
  totalPrice: decimal("total_price", { precision: 10, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  tenantUsers: many(tenantUsers),
}));

export const tenantsRelations = relations(tenants, ({ many }) => ({
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
}));

export const tenantUsersRelations = relations(tenantUsers, ({ one }) => ({
  tenant: one(tenants, { fields: [tenantUsers.tenantId], references: [tenants.id] }),
  user: one(users, { fields: [tenantUsers.userId], references: [users.id] }),
}));

export const branchesRelations = relations(branches, ({ one, many }) => ({
  tenant: one(tenants, { fields: [branches.tenantId], references: [tenants.id] }),
  inventory: many(inventory),
}));

export const categoriesRelations = relations(categories, ({ one, many }) => ({
  tenant: one(tenants, { fields: [categories.tenantId], references: [tenants.id] }),
  products: many(products),
}));

export const productsRelations = relations(products, ({ one, many }) => ({
  tenant: one(tenants, { fields: [products.tenantId], references: [tenants.id] }),
  category: one(categories, { fields: [products.categoryId], references: [categories.id] }),
  unit: one(units, { fields: [products.unitId], references: [units.id] }),
  variants: many(productVariants),
  attributes: many(productAttributes),
}));

export const productVariantsRelations = relations(productVariants, ({ one, many }) => ({
  product: one(products, { fields: [productVariants.productId], references: [products.id] }),
  inventory: many(inventory),
  stockMovements: many(stockMovements),
  batches: many(productBatches),
}));

export const inventoryRelations = relations(inventory, ({ one }) => ({
  variant: one(productVariants, { fields: [inventory.variantId], references: [productVariants.id] }),
  branch: one(branches, { fields: [inventory.branchId], references: [branches.id] }),
}));

export const stockMovementsRelations = relations(stockMovements, ({ one }) => ({
  variant: one(productVariants, { fields: [stockMovements.variantId], references: [productVariants.id] }),
  branch: one(branches, { fields: [stockMovements.branchId], references: [branches.id] }),
}));

export const salesOrdersRelations = relations(salesOrders, ({ one, many }) => ({
  tenant: one(tenants, { fields: [salesOrders.tenantId], references: [tenants.id] }),
  branch: one(branches, { fields: [salesOrders.branchId], references: [branches.id] }),
  items: many(salesOrderItems),
  refunds: many(refunds),
}));

export const salesOrderItemsRelations = relations(salesOrderItems, ({ one }) => ({
  order: one(salesOrders, { fields: [salesOrderItems.orderId], references: [salesOrders.id] }),
  variant: one(productVariants, { fields: [salesOrderItems.variantId], references: [productVariants.id] }),
}));

export const refundsRelations = relations(refunds, ({ one }) => ({
  order: one(salesOrders, { fields: [refunds.orderId], references: [salesOrders.id] }),
}));

export const branchStaffRelations = relations(branchStaff, ({ one }) => ({
  branch: one(branches, { fields: [branchStaff.branchId], references: [branches.id] }),
  tenantUser: one(tenantUsers, { fields: [branchStaff.tenantUserId], references: [tenantUsers.id] }),
}));

export const unitsRelations = relations(units, ({ one, many }) => ({
  tenant: one(tenants, { fields: [units.tenantId], references: [tenants.id] }),
  products: many(products),
}));

export const productBatchesRelations = relations(productBatches, ({ one }) => ({
  variant: one(productVariants, { fields: [productBatches.variantId], references: [productVariants.id] }),
  branch: one(branches, { fields: [productBatches.branchId], references: [branches.id] }),
  tenant: one(tenants, { fields: [productBatches.tenantId], references: [tenants.id] }),
}));

export const productAttributesRelations = relations(productAttributes, ({ one, many }) => ({
  product: one(products, { fields: [productAttributes.productId], references: [products.id] }),
  options: many(productAttributeOptions),
}));

export const productAttributeOptionsRelations = relations(productAttributeOptions, ({ one }) => ({
  attribute: one(productAttributes, { fields: [productAttributeOptions.attributeId], references: [productAttributes.id] }),
}));

export const suppliersRelations = relations(suppliers, ({ one, many }) => ({
  tenant: one(tenants, { fields: [suppliers.tenantId], references: [tenants.id] }),
  purchaseOrders: many(purchaseOrders),
}));

export const purchaseOrdersRelations = relations(purchaseOrders, ({ one, many }) => ({
  tenant: one(tenants, { fields: [purchaseOrders.tenantId], references: [tenants.id] }),
  supplier: one(suppliers, { fields: [purchaseOrders.supplierId], references: [suppliers.id] }),
  branch: one(branches, { fields: [purchaseOrders.branchId], references: [branches.id] }),
  items: many(purchaseOrderItems),
}));

export const purchaseOrderItemsRelations = relations(purchaseOrderItems, ({ one }) => ({
  purchaseOrder: one(purchaseOrders, { fields: [purchaseOrderItems.purchaseOrderId], references: [purchaseOrders.id] }),
  variant: one(productVariants, { fields: [purchaseOrderItems.variantId], references: [productVariants.id] }),
}));

export const transactionsRelations = relations(transactions, ({ one }) => ({
  tenant: one(tenants, { fields: [transactions.tenantId], references: [tenants.id] }),
  branch: one(branches, { fields: [transactions.branchId], references: [branches.id] }),
}));

export const integrationsRelations = relations(integrations, ({ one }) => ({
  tenant: one(tenants, { fields: [integrations.tenantId], references: [tenants.id] }),
}));

export const apiKeysRelations = relations(apiKeys, ({ one }) => ({
  tenant: one(tenants, { fields: [apiKeys.tenantId], references: [tenants.id] }),
}));

export const invoicesRelations = relations(invoices, ({ one, many }) => ({
  tenant: one(tenants, { fields: [invoices.tenantId], references: [tenants.id] }),
  order: one(salesOrders, { fields: [invoices.orderId], references: [salesOrders.id] }),
  branch: one(branches, { fields: [invoices.branchId], references: [branches.id] }),
  items: many(invoiceItems),
}));

export const invoiceItemsRelations = relations(invoiceItems, ({ one }) => ({
  invoice: one(invoices, { fields: [invoiceItems.invoiceId], references: [invoices.id] }),
}));
