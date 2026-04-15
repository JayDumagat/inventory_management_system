import { Request, Response } from "express";
import { db } from "../db";
import { salesOrders, salesOrderItems, inventory, productVariants, products, branches, categories } from "../db/schema";
import { eq, and, gte, lte, sql, desc } from "drizzle-orm";
import { parseDate } from "../utils/helpers";

export const salesReport = async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = req.tenantContext!.tenantId;
    const to = parseDate(req.query.to as string, new Date());
    const from = parseDate(req.query.from as string, new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000));

    const rows = await db
      .select({
        date: sql<string>`to_char(${salesOrders.createdAt}, 'YYYY-MM-DD')`,
        orderCount: sql<number>`count(*)::int`,
        revenue: sql<string>`coalesce(sum(${salesOrders.totalAmount}), 0)`,
      })
      .from(salesOrders)
      .where(
        and(
          eq(salesOrders.tenantId, tenantId),
          gte(salesOrders.createdAt, from),
          lte(salesOrders.createdAt, to)
        )
      )
      .groupBy(sql`to_char(${salesOrders.createdAt}, 'YYYY-MM-DD')`)
      .orderBy(sql`to_char(${salesOrders.createdAt}, 'YYYY-MM-DD')`);

    const totals = await db
      .select({
        totalOrders: sql<number>`count(*)::int`,
        totalRevenue: sql<string>`coalesce(sum(${salesOrders.totalAmount}), 0)`,
        avgOrderValue: sql<string>`coalesce(avg(${salesOrders.totalAmount}), 0)`,
      })
      .from(salesOrders)
      .where(
        and(
          eq(salesOrders.tenantId, tenantId),
          gte(salesOrders.createdAt, from),
          lte(salesOrders.createdAt, to)
        )
      );

    res.json({ from: from.toISOString(), to: to.toISOString(), byDay: rows, summary: totals[0] });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const inventoryReport = async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = req.tenantContext!.tenantId;

    const byBranch = await db
      .select({
        branchId: branches.id,
        branchName: branches.name,
        totalUnits: sql<number>`coalesce(sum(${inventory.quantity}), 0)::int`,
        stockValue: sql<string>`coalesce(sum(${inventory.quantity} * ${productVariants.costPrice}::numeric), 0)`,
      })
      .from(inventory)
      .innerJoin(branches, eq(inventory.branchId, branches.id))
      .innerJoin(productVariants, eq(inventory.variantId, productVariants.id))
      .innerJoin(products, eq(productVariants.productId, products.id))
      .where(eq(branches.tenantId, tenantId))
      .groupBy(branches.id, branches.name);

    const byCategory = await db
      .select({
        categoryId: categories.id,
        categoryName: categories.name,
        totalUnits: sql<number>`coalesce(sum(${inventory.quantity}), 0)::int`,
        stockValue: sql<string>`coalesce(sum(${inventory.quantity} * ${productVariants.costPrice}::numeric), 0)`,
      })
      .from(inventory)
      .innerJoin(productVariants, eq(inventory.variantId, productVariants.id))
      .innerJoin(products, eq(productVariants.productId, products.id))
      .innerJoin(categories, eq(products.categoryId, categories.id))
      .where(eq(products.tenantId, tenantId))
      .groupBy(categories.id, categories.name);

    const lowStock = await db
      .select({
        inventoryId: inventory.id,
        quantity: inventory.quantity,
        reorderPoint: inventory.reorderPoint,
        variantName: productVariants.name,
        sku: productVariants.sku,
        productName: products.name,
        branchName: branches.name,
      })
      .from(inventory)
      .innerJoin(productVariants, eq(inventory.variantId, productVariants.id))
      .innerJoin(products, eq(productVariants.productId, products.id))
      .innerJoin(branches, eq(inventory.branchId, branches.id))
      .where(
        and(
          eq(branches.tenantId, tenantId),
          sql`${inventory.quantity} <= ${inventory.reorderPoint}`
        )
      )
      .orderBy(inventory.quantity);

    const summary = await db
      .select({
        totalUnits: sql<number>`coalesce(sum(${inventory.quantity}), 0)::int`,
        totalValue: sql<string>`coalesce(sum(${inventory.quantity} * ${productVariants.costPrice}::numeric), 0)`,
        lowStockCount: sql<number>`count(case when ${inventory.quantity} <= ${inventory.reorderPoint} then 1 end)::int`,
      })
      .from(inventory)
      .innerJoin(productVariants, eq(inventory.variantId, productVariants.id))
      .innerJoin(products, eq(productVariants.productId, products.id))
      .innerJoin(branches, eq(inventory.branchId, branches.id))
      .where(eq(branches.tenantId, tenantId));

    res.json({ summary: summary[0], byBranch, byCategory, lowStock });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const productsReport = async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = req.tenantContext!.tenantId;
    const to = parseDate(req.query.to as string, new Date());
    const from = parseDate(req.query.from as string, new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000));
    const limit = Math.min(Number(req.query.limit) || 20, 100);

    const topProducts = await db
      .select({
        productId: products.id,
        productName: products.name,
        variantName: productVariants.name,
        sku: productVariants.sku,
        totalQty: sql<number>`coalesce(sum(${salesOrderItems.quantity}), 0)::int`,
        totalRevenue: sql<string>`coalesce(sum(${salesOrderItems.totalPrice}), 0)`,
      })
      .from(salesOrderItems)
      .innerJoin(productVariants, eq(salesOrderItems.variantId, productVariants.id))
      .innerJoin(products, eq(productVariants.productId, products.id))
      .innerJoin(salesOrders, eq(salesOrderItems.orderId, salesOrders.id))
      .where(
        and(
          eq(salesOrders.tenantId, tenantId),
          gte(salesOrders.createdAt, from),
          lte(salesOrders.createdAt, to)
        )
      )
      .groupBy(products.id, products.name, productVariants.name, productVariants.sku)
      .orderBy(desc(sql`sum(${salesOrderItems.quantity})`))
      .limit(limit);

    res.json({ from: from.toISOString(), to: to.toISOString(), products: topProducts });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Internal server error" });
  }
};
