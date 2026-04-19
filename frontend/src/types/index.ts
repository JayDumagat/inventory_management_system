// Shared TypeScript interfaces used across the application

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  description?: string;
  role: string;
}

export interface Branch {
  id: string;
  name: string;
  address?: string;
  city?: string;
  country?: string;
  phone?: string;
  isDefault: boolean;
}

export interface Notification {
  id: string;
  type: string;
  message: string;
  createdAt: string;
  resourceType: string;
  resourceId?: string;
}

export interface Variant {
  id: string;
  name: string;
  sku: string;
  barcode?: string | null;
  price: string;
  costPrice: string;
  isActive: boolean;
}

export interface Category {
  id: string;
  name: string;
  description?: string;
  parentId?: string | null;
}

export interface Unit {
  id: string;
  name: string;
  abbreviation: string;
  createdAt?: string;
}

export interface AttributeOption {
  id: string;
  value: string;
  sortOrder: number;
}

export interface Attribute {
  id: string;
  name: string;
  sortOrder: number;
  options: AttributeOption[];
}

export interface Product {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  type?: string;
  category?: Category;
  unit?: Unit;
  variants: Variant[];
  images?: ProductImage[];
}

export interface ProductImage {
  id: string;
  objectName: string;
  url: string;
  altText?: string;
  sortOrder: number;
}

export interface InventoryItem {
  id: string;
  quantity: number;
  reorderPoint: number;
  variant?: { id: string; name: string; sku: string; product?: { name: string } };
  branch?: { id: string; name: string };
}

export interface Movement {
  id: string;
  type: string;
  quantity: number;
  previousQuantity: number;
  newQuantity: number;
  notes?: string;
  createdAt: string;
  variantId: string;
  branchId: string;
  destinationBranchId?: string | null;
}

export interface Batch {
  id: string;
  batchNumber: string;
  quantity: number;
  expiryDate?: string | null;
  manufacturingDate?: string | null;
  notes?: string | null;
  variant?: { id: string; name: string; sku: string; product?: { name: string } };
  branch?: { id: string; name: string };
}

export interface OrderItem {
  id: string;
  productName: string;
  variantName: string;
  sku: string;
  quantity: number;
  unitPrice: string;
  totalPrice: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  status: string;
  totalAmount: string;
  subtotal: string;
  taxAmount: string;
  discountAmount: string;
  customerName?: string;
  customerEmail?: string;
  createdAt: string;
  branch?: { id: string; name: string };
  items: OrderItem[];
}

export interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: string;
  totalPrice: string;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  status: "draft" | "sent" | "paid" | "overdue" | "cancelled";
  customerName: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  customerAddress: string | null;
  subtotal: string;
  taxAmount: string;
  discountAmount: string;
  totalAmount: string;
  notes: string | null;
  dueDate: string | null;
  paidAt: string | null;
  createdAt: string;
  items: InvoiceItem[];
  order?: { orderNumber: string } | null;
  branch?: { name: string } | null;
}

export interface SalesOrder {
  id: string;
  orderNumber: string;
  customerName: string | null;
  totalAmount: string;
  status: string;
}

export interface Supplier {
  id: string;
  name: string;
  contactName?: string;
  email?: string;
  phone?: string;
  website?: string;
  address?: string;
  city?: string;
  country?: string;
  notes?: string;
  isActive: boolean;
  createdAt: string;
}

export interface PurchaseOrderItem {
  id: string;
  productName: string;
  variantName: string;
  sku: string;
  quantity: number;
  receivedQuantity: number;
  unitCost: string;
  totalCost: string;
}

export interface PurchaseOrder {
  id: string;
  orderNumber: string;
  status: string;
  subtotal: string;
  taxAmount: string;
  totalAmount: string;
  notes?: string;
  expectedDate?: string;
  receivedAt?: string;
  createdAt: string;
  supplierName?: string;
  supplierId?: string;
  branchName?: string;
  branchId?: string;
  items?: PurchaseOrderItem[];
}

export type TransactionType = "sale" | "purchase" | "expense" | "refund" | "adjustment" | "other";

export interface Transaction {
  id: string;
  type: TransactionType;
  amount: string;
  description: string;
  referenceType?: string;
  referenceId?: string;
  notes?: string;
  branchId?: string;
  branchName?: string;
  createdAt: string;
}

export interface Customer {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  country?: string;
  notes?: string;
  loyaltyPoints?: number;
  createdAt: string;
  ordersCount?: number;
  totalSpent?: string;
}

export interface StaffMember {
  tenantUserId: string;
  userId: string;
  role: string;
  isActive: boolean;
  email: string;
  firstName: string;
  lastName: string;
  createdAt: string;
  allowedPages?: string[];
  branches: { id: string; name: string }[];
}

export interface DashboardStats {
  stats: {
    totalProducts: number;
    ordersLast30Days: number;
    revenueLast30Days: number;
    lowStockCount: number;
  };
  recentOrders: Array<{
    id: string;
    orderNumber: string;
    status: string;
    totalAmount: string;
    createdAt: string;
    customerName?: string;
  }>;
  salesByDay: Array<{ date: string; total: number; count: number }>;
  lowStockItems: Array<{
    id: string;
    quantity: number;
    reorderPoint: number;
    variant?: { name: string; sku: string; product?: { name: string } };
    branch?: { name: string };
  }>;
}

export interface Integration {
  id: string | null;
  provider: string;
  isEnabled: boolean;
  webhookUrl?: string | null;
  config?: Record<string, unknown>;
}

export interface ApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  isActive: boolean;
  expiresAt?: string | null;
  lastUsedAt?: string | null;
  createdAt: string;
  createdByEmail?: string;
}

export interface AuditLog {
  id: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  userId?: string;
  ipAddress?: string;
  createdAt: string;
  oldValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
  actorEmail?: string;
  actorFirstName?: string;
  actorLastName?: string;
}

export interface SalesReport {
  from: string;
  to: string;
  byDay: { date: string; orderCount: number; revenue: string }[];
  summary: { totalOrders: number; totalRevenue: string; avgOrderValue: string };
}

export interface InventoryReport {
  summary: { totalUnits: number; totalValue: string; lowStockCount: number };
  byBranch: { branchId: string; branchName: string; totalUnits: number; stockValue: string }[];
  byCategory: { categoryId: string; categoryName: string; totalUnits: number; stockValue: string }[];
  lowStock: { inventoryId: string; quantity: number; reorderPoint: number; variantName: string; sku: string; productName: string; branchName: string }[];
}

export interface ProductsReport {
  from: string;
  to: string;
  products: { productId: string; productName: string; variantName: string; sku: string; totalQty: number; totalRevenue: string }[];
}

// POS-specific types
export interface CartItem {
  variantId: string;
  productName: string;
  variantName: string;
  sku: string;
  price: number;
  quantity: number;
}

export interface Receipt {
  orderNumber: string;
  items: CartItem[];
  subtotal: number;
  discount: number;
  loyaltyDiscount: number;
  total: number;
  paymentMethod: string;
  change: number;
  paid: number;
  promotionCode?: string;
  loyaltyPointsEarned?: number;
  loyaltyPointsRedeemed?: number;
}

// Product list variant used in orders/inventory/purchases (subset)
export interface ProductListItem {
  id: string;
  name: string;
  variants: { id: string; name: string; sku: string; price?: string; costPrice?: string }[];
}

// ─── Subscription / Plan ──────────────────────────────────────────────────────
export interface PlanLimits {
  branches: number;
  products: number;
  api_keys: number;
  invoices_per_month: number;
}

export interface PlanDefinition {
  key: string;
  name: string;
  monthlyPrice: number;
  annualPrice: number;
  features: string[];
  limits: PlanLimits;
}

export interface TenantSubscription {
  id: string;
  tenantId: string;
  planKey: string;
  status: string;
  currentPeriodStart: string;
  currentPeriodEnd?: string;
  cancelAtPeriodEnd: boolean;
  trialEndsAt?: string;
  addonLimits: Record<string, number>;
  createdAt: string;
  updatedAt: string;
}

export interface UsageMetric {
  current: number;
  limit: number;
}

export interface SubscriptionUsage {
  branches: UsageMetric;
  products: UsageMetric;
  api_keys: UsageMetric;
  invoices_per_month: UsageMetric;
}

export interface SubscriptionAddon {
  id: string;
  tenantId: string;
  addonKey: string;
  quantity: number;
  createdAt: string;
}

export interface SubscriptionHistoryEntry {
  id: string;
  fromPlan: string;
  toPlan: string;
  reason?: string;
  effectiveAt: string;
}

// ─── Promotions ───────────────────────────────────────────────────────────────
export type PromotionType = "percentage_off" | "fixed_amount" | "bogo" | "free_shipping" | "tiered";
export type PromotionDiscountType = "percentage" | "fixed";

export interface Promotion {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  code?: string;
  type: PromotionType;
  discountType: PromotionDiscountType;
  discountValue: string;
  minimumOrderAmount?: string;
  maximumDiscountAmount?: string;
  buyQuantity?: number;
  getQuantity?: number;
  scope: string;
  eligibility: string;
  usageLimitTotal?: number;
  usageLimitPerCustomer?: number;
  usageCount: number;
  startsAt?: string;
  endsAt?: string;
  isActive: boolean;
  stackable: boolean;
  priority: number;
  createdAt: string;
  updatedAt: string;
}

export interface ApplyPromotionResult {
  valid: boolean;
  promotionId: string;
  promotionCode?: string;
  promotionName: string;
  discountAmount: number;
  discountType: PromotionDiscountType;
  discountValue: number;
}

// ─── Loyalty ──────────────────────────────────────────────────────────────────
export interface LoyaltyConfig {
  id: string;
  tenantId: string;
  isEnabled: boolean;
  pointsPerDollar: string;
  pointsPerRedemptionDollar: string;
  minimumPointsToRedeem: number;
  maximumRedeemPercent: number;
  pointsExpireDays?: number;
  programName: string;
  pointsLabel: string;
  createdAt: string;
  updatedAt: string;
}

export interface LoyaltyLedgerEntry {
  id: string;
  type: string;
  points: number;
  balanceBefore: number;
  balanceAfter: number;
  notes?: string;
  expiresAt?: string;
  createdAt: string;
}

export interface CustomerLoyalty {
  customerId: string;
  customerName: string;
  balance: number;
  ledger: LoyaltyLedgerEntry[];
}

// ─── Superadmin ───────────────────────────────────────────────────────────────
export interface SuperadminUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: "owner" | "staff";
  isActive: boolean;
  allowedPages: string[];
  createdAt?: string;
}

export interface SuperadminTenantRow {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  plan: string;
  createdAt: string;
}

export interface SuperadminTenantDetail {
  tenant: {
    id: string;
    name: string;
    slug: string;
    description?: string;
    isActive: boolean;
    plan: string;
    createdAt: string;
  };
  subscription: TenantSubscription | null;
  memberCount: number;
}

export interface PlatformReports {
  totalTenants: number;
  newTenantsLast30Days: number;
  mrr: number;
  arr: number;
  byPlan: { plan: string; count: number }[];
  byStatus: { status: string; count: number }[];
}

// ─── Support Tickets ──────────────────────────────────────────────────────────
export type TicketStatus = "open" | "in_progress" | "waiting_on_customer" | "resolved" | "closed";
export type TicketPriority = "low" | "medium" | "high" | "urgent";
export type TicketCategory = "general" | "billing" | "technical" | "feature_request" | "bug_report" | "account";

export interface SupportTicket {
  id: string;
  ticketNumber: string;
  tenantId?: string;
  submittedByUserId?: string;
  submitterEmail: string;
  submitterName?: string;
  category: TicketCategory;
  priority: TicketPriority;
  subject: string;
  status: TicketStatus;
  assignedTo?: string;
  resolvedAt?: string;
  closedAt?: string;
  createdAt: string;
  updatedAt: string;
  tenantName?: string;
}

export interface TicketMessage {
  id: string;
  ticketId: string;
  senderType: "tenant_user" | "superadmin";
  senderId?: string;
  senderEmail?: string;
  senderName?: string;
  body: string;
  isInternal: boolean;
  createdAt: string;
}
