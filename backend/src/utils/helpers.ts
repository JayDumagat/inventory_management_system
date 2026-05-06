import { db } from "../db";
import { salesOrders, purchaseOrders, invoices } from "../db/schema";
import { eq, count } from "drizzle-orm";

export async function generateSalesOrderNumber(tenantId: string): Promise<string> {
  const [{ total }] = await db.select({ total: count() }).from(salesOrders).where(eq(salesOrders.tenantId, tenantId));
  return `SO-${String(Number(total) + 1).padStart(8, "0")}`;
}

export async function generatePurchaseOrderNumber(tenantId: string): Promise<string> {
  const [{ total }] = await db.select({ total: count() }).from(purchaseOrders).where(eq(purchaseOrders.tenantId, tenantId));
  return `PO-${String(Number(total) + 1).padStart(8, "0")}`;
}

export async function generateInvoiceNumber(tenantId: string): Promise<string> {
  const [{ total }] = await db.select({ total: count() }).from(invoices).where(eq(invoices.tenantId, tenantId));
  return `INV-${String(Number(total) + 1).padStart(8, "0")}`;
}

export function parseDate(str: string | undefined, fallback: Date): Date {
  if (!str) return fallback;
  const d = new Date(str);
  return isNaN(d.getTime()) ? fallback : d;
}
