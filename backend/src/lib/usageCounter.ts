/**
 * Redis-backed usage counters for per-tenant resource metering.
 * Falls back gracefully to database counts when Redis is unavailable.
 */

import { getRedisClient } from "./redis";
import { db } from "../db";
import { branches, products, apiKeys, invoices } from "../db/schema";
import { eq, and, gte } from "drizzle-orm";

type CounterResource = "branches" | "products" | "api_keys" | "invoices_per_month";

function counterKey(tenantId: string, resource: CounterResource): string {
  if (resource === "invoices_per_month") {
    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    return `usage:${tenantId}:${resource}:${month}`;
  }
  return `usage:${tenantId}:${resource}`;
}

/** Increment counter and return new value. Returns null if Redis unavailable. */
export async function incrementCounter(
  tenantId: string,
  resource: CounterResource,
): Promise<number | null> {
  const client = getRedisClient();
  if (!client) return null;
  try {
    const key = counterKey(tenantId, resource);
    const val = await client.incr(key);
    // Set a 25-hour expiry on monthly counters so they auto-clean
    if (resource === "invoices_per_month") {
      await client.expire(key, 60 * 60 * 25);
    }
    return val;
  } catch {
    return null;
  }
}

export async function decrementCounter(
  tenantId: string,
  resource: CounterResource,
): Promise<void> {
  const client = getRedisClient();
  if (!client) return;
  try {
    const key = counterKey(tenantId, resource);
    await client.decr(key);
  } catch {
    // non-fatal
  }
}

/** Get current count. Falls back to DB query if Redis is unavailable or key missing. */
export async function getCount(
  tenantId: string,
  resource: CounterResource,
): Promise<number> {
  const client = getRedisClient();
  if (client) {
    try {
      const key = counterKey(tenantId, resource);
      const val = await client.get(key);
      if (val !== null) return parseInt(val, 10);
    } catch {
      // fall through to DB
    }
  }
  return getCountFromDb(tenantId, resource);
}

/** Authoritative DB count — used for reconciliation and Redis cache miss. */
export async function getCountFromDb(
  tenantId: string,
  resource: CounterResource,
): Promise<number> {
  try {
    switch (resource) {
      case "branches": {
        const rows = await db.select({ id: branches.id }).from(branches)
          .where(eq(branches.tenantId, tenantId));
        return rows.length;
      }
      case "products": {
        const rows = await db.select({ id: products.id }).from(products)
          .where(eq(products.tenantId, tenantId));
        return rows.length;
      }
      case "api_keys": {
        const rows = await db.select({ id: apiKeys.id }).from(apiKeys)
          .where(and(eq(apiKeys.tenantId, tenantId), eq(apiKeys.isActive, true)));
        return rows.length;
      }
      case "invoices_per_month": {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const rows = await db.select({ id: invoices.id }).from(invoices)
          .where(and(eq(invoices.tenantId, tenantId), gte(invoices.createdAt, startOfMonth)));
        return rows.length;
      }
    }
  } catch {
    return 0;
  }
}

/** Refresh Redis counter from DB (reconciliation). */
export async function reconcileCounter(
  tenantId: string,
  resource: CounterResource,
): Promise<void> {
  const client = getRedisClient();
  if (!client) return;
  try {
    const count = await getCountFromDb(tenantId, resource);
    const key = counterKey(tenantId, resource);
    await client.set(key, String(count));
    if (resource === "invoices_per_month") {
      await client.expire(key, 60 * 60 * 25);
    }
  } catch {
    // non-fatal
  }
}
