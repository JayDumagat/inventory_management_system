import { Router, Request, Response } from "express";
import { db } from "../db";
import { inventory, stockMovements } from "../db/schema";
import { eq, and, gte } from "drizzle-orm";
import { authenticate, requireTenant } from "../middleware/auth";

const router = Router({ mergeParams: true });

interface Notification {
  id: string;
  type: string;
  message: string;
  resourceType: string;
  resourceId?: string;
  createdAt: Date;
}

// GET /api/tenants/:tenantId/notifications
router.get("/", authenticate, requireTenant(), async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = req.tenantContext!.tenantId;
    const notifications: Notification[] = [];

    // Low stock notifications
    const lowStockItems = await db.query.inventory.findMany({
      with: {
        variant: { with: { product: true } },
      },
    });

    for (const item of lowStockItems) {
      if (
        item.variant?.product?.tenantId === tenantId &&
        item.quantity > 0 &&
        item.reorderPoint > 0 &&
        item.quantity <= item.reorderPoint
      ) {
        const productName = item.variant?.product?.name ?? "Unknown product";
        const variantName = item.variant?.name ?? "Unknown variant";
        notifications.push({
          id: `low_stock_${item.id}`,
          type: "low_stock",
          message: `${productName} — ${variantName} is running low (qty: ${item.quantity}, reorder at: ${item.reorderPoint})`,
          resourceType: "inventory",
          resourceId: item.id,
          createdAt: item.updatedAt,
        });
      }
    }

    // Recent transfers (last 7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const recentTransfers = await db
      .select()
      .from(stockMovements)
      .where(
        and(
          eq(stockMovements.tenantId, tenantId),
          eq(stockMovements.type, "transfer"),
          gte(stockMovements.createdAt, sevenDaysAgo)
        )
      );

    for (const movement of recentTransfers) {
      notifications.push({
        id: `transfer_${movement.id}`,
        type: "transfer",
        message: `Transfer: Qty ${movement.quantity} of variantId ${movement.variantId.slice(0, 8)} transferred`,
        resourceType: "stockMovement",
        resourceId: movement.id,
        createdAt: movement.createdAt,
      });
    }

    // Sort by createdAt desc and limit to 20
    notifications.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    const result = notifications.slice(0, 20);

    res.json(result);
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
