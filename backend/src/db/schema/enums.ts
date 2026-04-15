import { pgEnum } from "drizzle-orm/pg-core";

export const tenantUserRoleEnum = pgEnum("tenant_user_role", ["owner", "admin", "manager", "staff"]);
export const stockMovementTypeEnum = pgEnum("stock_movement_type", ["in", "out", "transfer", "adjustment", "return"]);
export const salesOrderStatusEnum = pgEnum("sales_order_status", ["draft", "confirmed", "processing", "shipped", "delivered", "cancelled", "refunded"]);
export const auditActionEnum = pgEnum("audit_action", ["create", "update", "delete", "login", "logout", "other"]);
export const purchaseOrderStatusEnum = pgEnum("purchase_order_status", ["draft", "ordered", "partial", "received", "cancelled"]);
export const transactionTypeEnum = pgEnum("transaction_type", ["sale", "purchase", "expense", "refund", "adjustment", "other"]);
export const productTypeEnum = pgEnum("product_type", ["physical", "digital", "service", "bundle"]);
export const invoiceStatusEnum = pgEnum("invoice_status", ["draft", "sent", "paid", "overdue", "cancelled"]);
