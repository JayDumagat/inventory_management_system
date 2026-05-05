import { Request, Response } from "express";
import { db } from "../db";
import { salesOrders, inventory, products } from "../db/schema";
import { eq, desc, gte, sql, and } from "drizzle-orm";
import { cacheGet, cacheSet } from "../lib/redis";

const DASHBOARD_TTL = 60;

export const getStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = req.tenantContext!.tenantId;
    const branchId = typeof req.query.branchId === "string" ? req.query.branchId : undefined;
    const cacheKey = `dashboard:${tenantId}:${branchId ?? "all"}:stats`;

    const cached = await cacheGet<object>(cacheKey);
    if (cached) {
      res.json(cached);
      return;
    }

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [productCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(products)
      .where(eq(products.tenantId, tenantId));

    const orderWhere = branchId
      ? and(eq(salesOrders.tenantId, tenantId), eq(salesOrders.branchId, branchId), gte(salesOrders.createdAt, thirtyDaysAgo))
      : and(eq(salesOrders.tenantId, tenantId), gte(salesOrders.createdAt, thirtyDaysAgo));

    const [orderCount] = await db
      .select({ count: sql<number>`count(*)`, total: sql<number>`coalesce(sum(total_amount::numeric), 0)` })
      .from(salesOrders)
      .where(orderWhere);

    const lowStockItems = await db.query.inventory.findMany({
      where: sql`${inventory.quantity} <= ${inventory.reorderPoint} AND ${inventory.reorderPoint} > 0`,
      with: { variant: { with: { product: true } }, branch: true },
      limit: 10,
    });

    const recentOrderWhere = branchId
      ? and(eq(salesOrders.tenantId, tenantId), eq(salesOrders.branchId, branchId))
      : eq(salesOrders.tenantId, tenantId);

    const recentOrders = await db
      .select()
      .from(salesOrders)
      .where(recentOrderWhere)
      .orderBy(desc(salesOrders.createdAt))
      .limit(5);

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const salesByDayWhere = branchId
      ? and(eq(salesOrders.tenantId, tenantId), eq(salesOrders.branchId, branchId), gte(salesOrders.createdAt, sevenDaysAgo))
      : and(eq(salesOrders.tenantId, tenantId), gte(salesOrders.createdAt, sevenDaysAgo));

    const salesByDay = await db
      .select({
        date: sql<string>`DATE(created_at)`,
        total: sql<number>`sum(total_amount::numeric)`,
        count: sql<number>`count(*)`,
      })
      .from(salesOrders)
      .where(salesByDayWhere)
      .groupBy(sql`DATE(created_at)`)
      .orderBy(sql`DATE(created_at)`);

    const tenantLowStock = lowStockItems.filter((i) => {
      if (i.variant?.product?.tenantId !== tenantId) return false;
      if (branchId && i.branch?.id !== branchId) return false;
      return true;
    });

    const result = {
      stats: {
        totalProducts: Number(productCount?.count ?? 0),
        ordersLast30Days: Number(orderCount?.count ?? 0),
        revenueLast30Days: Number(orderCount?.total ?? 0),
        lowStockCount: tenantLowStock.length,
      },
      recentOrders,
      salesByDay,
      lowStockItems: tenantLowStock,
    };

    await cacheSet(cacheKey, result, DASHBOARD_TTL);
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
};
