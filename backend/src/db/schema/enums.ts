import { pgEnum } from "drizzle-orm/pg-core";

export const tenantUserRoleEnum = pgEnum("tenant_user_role", ["owner", "admin", "manager", "staff"]);
export const stockMovementTypeEnum = pgEnum("stock_movement_type", ["in", "out", "transfer", "adjustment", "return"]);
export const salesOrderStatusEnum = pgEnum("sales_order_status", ["draft", "confirmed", "processing", "shipped", "delivered", "cancelled", "refunded"]);
export const auditActionEnum = pgEnum("audit_action", ["create", "update", "delete", "login", "logout", "other"]);
export const purchaseOrderStatusEnum = pgEnum("purchase_order_status", ["draft", "ordered", "partial", "received", "cancelled"]);
export const transactionTypeEnum = pgEnum("transaction_type", ["sale", "purchase", "expense", "refund", "adjustment", "other"]);
export const productTypeEnum = pgEnum("product_type", ["physical", "digital", "service", "bundle"]);
export const invoiceStatusEnum = pgEnum("invoice_status", ["draft", "sent", "paid", "overdue", "cancelled"]);

// ── Subscription ──────────────────────────────────────────────────────────────
export const subscriptionStatusEnum = pgEnum("subscription_status", [
  "active", "trialing", "overdue", "canceled", "paused",
]);

// ── Promotions ────────────────────────────────────────────────────────────────
export const promotionTypeEnum = pgEnum("promotion_type", [
  "percentage_off", "fixed_amount", "bogo", "free_shipping", "tiered",
]);
export const promotionDiscountTypeEnum = pgEnum("promotion_discount_type", [
  "percentage", "fixed",
]);

// ── Loyalty ───────────────────────────────────────────────────────────────────
export const loyaltyTxTypeEnum = pgEnum("loyalty_tx_type", [
  "earn", "redeem", "adjust", "expire",
]);
