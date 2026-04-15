import type { TransactionType } from "../types";

export type BadgeVariant = "default" | "success" | "warning" | "danger" | "info";

export const orderStatusColor: Record<string, BadgeVariant> = {
  draft: "default",
  confirmed: "info",
  processing: "warning",
  shipped: "info",
  delivered: "success",
  cancelled: "danger",
  refunded: "warning",
};

export const invoiceStatusVariant: Record<string, BadgeVariant> = {
  draft: "default",
  sent: "info",
  paid: "success",
  overdue: "danger",
  cancelled: "default",
};

export const purchaseOrderStatusColor: Record<string, BadgeVariant> = {
  draft: "default",
  ordered: "info",
  partial: "warning",
  received: "success",
  cancelled: "danger",
};

export const auditActionColor: Record<string, BadgeVariant> = {
  create: "success",
  update: "info",
  delete: "danger",
  login: "default",
  logout: "default",
  other: "warning",
};

export const transactionTypeColors: Record<TransactionType, BadgeVariant> = {
  sale: "success",
  purchase: "danger",
  expense: "danger",
  refund: "warning",
  adjustment: "info",
  other: "default",
};

export const transactionTypeSign: Record<TransactionType, number> = {
  sale: 1,
  purchase: -1,
  expense: -1,
  refund: -1,
  adjustment: 1,
  other: 1,
};

export const movementBadge: Record<string, BadgeVariant> = {
  in: "success",
  out: "danger",
  adjustment: "warning",
  transfer: "info",
  return: "default",
};

export const roleColors: Record<string, BadgeVariant> = {
  owner: "danger",
  admin: "warning",
  manager: "info",
  staff: "default",
};
