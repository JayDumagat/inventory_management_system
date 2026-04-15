export function generateSalesOrderNumber(): string {
  return `ORD-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
}

export function generatePurchaseOrderNumber(): string {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `PO-${ts}-${rand}`;
}

export function parseDate(str: string | undefined, fallback: Date): Date {
  if (!str) return fallback;
  const d = new Date(str);
  return isNaN(d.getTime()) ? fallback : d;
}
