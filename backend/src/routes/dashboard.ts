import { Router, Request, Response } from "express";
import { db } from "../db";
import { salesOrders, inventory, products } from "../db/schema";
import { eq, desc, gte, sql, and } from "drizzle-orm";
import { authenticate, requireTenant } from "../middleware/auth";

const router = Router({ mergeParams: true });

router.get("/stats", authenticate, requireTenant(), async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = req.tenantContext!.tenantId;
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Total products
    const [productCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(products)
      .where(eq(products.tenantId, tenantId));

    // Total orders last 30 days
    const [orderCount] = await db
      .select({ count: sql<number>`count(*)`, total: sql<number>`coalesce(sum(total_amount::numeric), 0)` })
      .from(salesOrders)
      .where(and(eq(salesOrders.tenantId, tenantId), gte(salesOrders.createdAt, thirtyDaysAgo)));

    // Low stock items (quantity <= reorderPoint)
    const lowStockItems = await db.query.inventory.findMany({
      where: sql`${inventory.quantity} <= ${inventory.reorderPoint} AND ${inventory.reorderPoint} > 0`,
      with: { variant: { with: { product: true } }, branch: true },
      limit: 10,
    });

    // Recent orders
    const recentOrders = await db
      .select()
      .from(salesOrders)
      .where(eq(salesOrders.tenantId, tenantId))
      .orderBy(desc(salesOrders.createdAt))
      .limit(5);

    // Sales by day (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const salesByDay = await db
      .select({
        date: sql<string>`DATE(created_at)`,
        total: sql<number>`sum(total_amount::numeric)`,
        count: sql<number>`count(*)`,
      })
      .from(salesOrders)
      .where(and(eq(salesOrders.tenantId, tenantId), gte(salesOrders.createdAt, sevenDaysAgo)))
      .groupBy(sql`DATE(created_at)`)
      .orderBy(sql`DATE(created_at)`);

    res.json({
      stats: {
        totalProducts: Number(productCount?.count ?? 0),
        ordersLast30Days: Number(orderCount?.count ?? 0),
        revenueLast30Days: Number(orderCount?.total ?? 0),
        lowStockCount: lowStockItems.filter(i => i.variant?.product?.tenantId === tenantId).length,
      },
      recentOrders,
      salesByDay,
      lowStockItems: lowStockItems.filter(i => i.variant?.product?.tenantId === tenantId),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
