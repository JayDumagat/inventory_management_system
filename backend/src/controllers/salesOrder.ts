import { Request, Response } from "express";
import { db } from "../db";
import {
  salesOrders, salesOrderItems, inventory, stockMovements, refunds, transactions,
  promotions, promotionUsage, loyaltyConfig, loyaltyLedger, customers, productVariants, products, tenants,
} from "../db/schema";
import { eq, and, desc, inArray } from "drizzle-orm";
import { createAuditLog } from "../services/audit";
import { handleControllerError } from "../utils/errors";
import { createOrderSchema, updateOrderSchema, refundSchema } from "../validators/salesOrder";
import { generateSalesOrderNumber } from "../utils/helpers";
import { appEvents } from "../lib/events";
import { hasFeature } from "../lib/planConfig";

async function getTrackStockByVariantIds(variantIds: string[]): Promise<Map<string, boolean>> {
  if (variantIds.length === 0) return new Map<string, boolean>();
  const rows = await db
    .select({
      variantId: productVariants.id,
      trackStock: products.trackStock,
    })
    .from(productVariants)
    .innerJoin(products, eq(productVariants.productId, products.id))
    .where(inArray(productVariants.id, variantIds));
  return new Map(rows.map((row) => [row.variantId, row.trackStock]));
}

export async function listOrders(req: Request, res: Response): Promise<void> {
  try {
    const branchId = typeof req.query.branchId === "string" ? req.query.branchId : undefined;
    const whereCondition = branchId
      ? and(eq(salesOrders.tenantId, req.tenantContext!.tenantId), eq(salesOrders.branchId, branchId))
      : eq(salesOrders.tenantId, req.tenantContext!.tenantId);
    const orders = await db.query.salesOrders.findMany({
      where: whereCondition,
      with: { items: true, branch: true, refunds: true },
      orderBy: (o, { desc: d }) => [d(o.createdAt)],
    });
    res.json(orders);
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function createOrder(req: Request, res: Response): Promise<void> {
  try {
    const body = createOrderSchema.parse(req.body);
    const tenantId = req.tenantContext!.tenantId;
    const loyaltyFeatureEnabled = hasFeature(req.tenantContext!.planKey ?? "free", "loyalty");
    const [tenant] = await db
      .select({ taxRate: tenants.taxRate })
      .from(tenants)
      .where(eq(tenants.id, tenantId));

    const subtotal = body.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
    const orgTaxRate = Number(tenant?.taxRate ?? 0);
    const taxAmount = Math.round(subtotal * orgTaxRate) / 100;
    const promoDiscount = body.discountAmount ?? 0;
    const loyaltyDiscount = loyaltyFeatureEnabled ? (body.loyaltyDiscountAmount ?? 0) : 0;
    const totalAmount = subtotal + taxAmount - promoDiscount - loyaltyDiscount;

    // Validate total is positive
    if (totalAmount < 0) {
      res.status(400).json({ error: "Total amount cannot be negative" });
      return;
    }

    // Validate items have positive quantities and prices
    for (const item of body.items) {
      if (item.quantity <= 0) {
        res.status(400).json({ error: `Invalid quantity for ${item.productName}` });
        return;
      }
      if (item.unitPrice < 0) {
        res.status(400).json({ error: `Invalid price for ${item.productName}` });
        return;
      }
    }

    const requestedStatus = body.status || "draft";
    const variantTrackStockMap = await getTrackStockByVariantIds(body.items.map((item) => item.variantId));

    // If the order is being immediately completed (POS sale), verify and deduct stock
    if (requestedStatus === "delivered" || requestedStatus === "confirmed") {
      for (const item of body.items) {
        const trackStock = variantTrackStockMap.get(item.variantId) ?? true;
        if (!trackStock) continue;
        const [inv] = await db.select().from(inventory).where(and(eq(inventory.variantId, item.variantId), eq(inventory.branchId, body.branchId)));
        if (!inv || inv.quantity < item.quantity) {
          res.status(400).json({ error: `Insufficient stock for ${item.productName} - ${item.variantName}` });
          return;
        }
      }
    }

    const notes = body.paymentMethod 
      ? (body.notes ? `${body.notes} | Payment: ${body.paymentMethod}` : `Payment: ${body.paymentMethod}`)
      : body.notes;

    const [order] = await db.insert(salesOrders).values({
      tenantId,
      branchId: body.branchId,
      orderNumber: await generateSalesOrderNumber(tenantId),
      status: requestedStatus,
      customerName: body.customerName,
      customerEmail: body.customerEmail || undefined,
      customerPhone: body.customerPhone,
      subtotal: String(subtotal),
      taxAmount: String(taxAmount),
      discountAmount: String(promoDiscount),
      totalAmount: String(totalAmount),
      notes,
      promotionId: body.promotionId ?? undefined,
      promotionCode: body.promotionCode ?? undefined,
      loyaltyPointsRedeemed: loyaltyFeatureEnabled ? (body.loyaltyPointsRedeemed ?? 0) : 0,
      loyaltyDiscountAmount: String(loyaltyDiscount),
      createdBy: req.user!.id,
    }).returning();

    await db.insert(salesOrderItems).values(
      body.items.map((item) => ({
        orderId: order.id,
        variantId: item.variantId,
        productName: item.productName,
        variantName: item.variantName,
        sku: item.sku,
        quantity: item.quantity,
        unitPrice: String(item.unitPrice),
        totalPrice: String(item.quantity * item.unitPrice),
      })),
    );

    // If order is immediately delivered/confirmed, deduct stock
    if (requestedStatus === "delivered" || requestedStatus === "confirmed") {
      for (const item of body.items) {
        const trackStock = variantTrackStockMap.get(item.variantId) ?? true;
        if (!trackStock) continue;
        const [inv] = await db.select().from(inventory).where(and(eq(inventory.variantId, item.variantId), eq(inventory.branchId, body.branchId)));
        if (inv) {
          await db.update(inventory).set({ quantity: inv.quantity - item.quantity, updatedAt: new Date() }).where(eq(inventory.id, inv.id));
          await db.insert(stockMovements).values({
            tenantId,
            variantId: item.variantId,
            branchId: body.branchId,
            type: "out",
            quantity: item.quantity,
            previousQuantity: inv.quantity,
            newQuantity: inv.quantity - item.quantity,
            referenceType: "sales_order",
            referenceId: order.id,
            createdBy: req.user!.id,
          });
        }
      }

      // Auto-record a sale transaction
      await db.insert(transactions).values({
        tenantId,
        branchId: body.branchId,
        type: "sale",
        amount: totalAmount.toFixed(2),
        description: `Sale — Order ${order.orderNumber}${body.customerName ? ` (${body.customerName})` : ""}`,
        referenceType: "sales_order",
        referenceId: order.id,
        notes: notes ?? null,
        createdBy: req.user!.id,
      });

      // ── Promotion usage tracking ──────────────────────────────────────────
      if (body.promotionId) {
        await db.insert(promotionUsage).values({
          promotionId: body.promotionId,
          tenantId,
          orderId: order.id,
          customerId: body.customerId ?? undefined,
          discountApplied: String(promoDiscount),
        }).catch(() => {}); // non-fatal

        // Increment usage count
        const [currentPromo] = await db.select({ usageCount: promotions.usageCount })
          .from(promotions)
          .where(eq(promotions.id, body.promotionId));
        if (currentPromo) {
          await db.update(promotions)
            .set({ usageCount: currentPromo.usageCount + 1 })
            .where(eq(promotions.id, body.promotionId))
            .catch(() => {});
        }
      }

      // ── Loyalty points earn ───────────────────────────────────────────────
      if (body.customerId && loyaltyFeatureEnabled) {
        const [lConfig] = await db.select().from(loyaltyConfig)
          .where(eq(loyaltyConfig.tenantId, tenantId));

        if (lConfig?.isEnabled) {
          const [customer] = await db.select().from(customers)
            .where(and(eq(customers.id, body.customerId), eq(customers.tenantId, tenantId)));

          if (customer) {
            // Handle loyalty points redemption first
            let balanceAfterRedeem = customer.loyaltyPoints;
            if ((body.loyaltyPointsRedeemed ?? 0) > 0) {
              balanceAfterRedeem = Math.max(0, customer.loyaltyPoints - (body.loyaltyPointsRedeemed ?? 0));
              await db.update(customers)
                .set({ loyaltyPoints: balanceAfterRedeem, updatedAt: new Date() })
                .where(eq(customers.id, customer.id));
              await db.insert(loyaltyLedger).values({
                tenantId,
                customerId: customer.id,
                orderId: order.id,
                type: "redeem",
                points: -(body.loyaltyPointsRedeemed ?? 0),
                balanceBefore: customer.loyaltyPoints,
                balanceAfter: balanceAfterRedeem,
                notes: `Redeemed on order ${order.orderNumber}`,
                createdBy: req.user!.id,
              }).catch(() => {});
            }

            // Earn points on the amount paid (net of all discounts)
            const pointsEarned = Math.floor(Number(totalAmount) * Number(lConfig.pointsPerDollar));
            if (pointsEarned > 0) {
              const newBalance = balanceAfterRedeem + pointsEarned;
              await db.update(customers)
                .set({ loyaltyPoints: newBalance, updatedAt: new Date() })
                .where(eq(customers.id, customer.id));
              await db.insert(loyaltyLedger).values({
                tenantId,
                customerId: customer.id,
                orderId: order.id,
                type: "earn",
                points: pointsEarned,
                balanceBefore: balanceAfterRedeem,
                balanceAfter: newBalance,
                notes: `Earned on order ${order.orderNumber}`,
                createdBy: req.user!.id,
              }).catch(() => {});

              // Store points earned on order
              await db.update(salesOrders)
                .set({ loyaltyPointsEarned: pointsEarned })
                .where(eq(salesOrders.id, order.id))
                .catch(() => {});
            }
          }
        }
      }
    }

    await createAuditLog({ tenantId, userId: req.user!.id, action: "create", resourceType: "sales_order", resourceId: order.id });

    appEvents.emit("order.created", {
      tenantId,
      orderId: order.id,
      orderNumber: order.orderNumber,
      totalAmount: Number(order.totalAmount),
      customerId: body.customerId,
    });

    res.status(201).json(order);
  } catch (error) {
    handleControllerError(error, res);
  }
}

export async function getOrder(req: Request, res: Response): Promise<void> {
  try {
    const order = await db.query.salesOrders.findFirst({
      where: and(eq(salesOrders.id, req.params.orderId as string), eq(salesOrders.tenantId, req.tenantContext!.tenantId)),
      with: { items: true, branch: true, refunds: true },
    });
    if (!order) {
      res.status(404).json({ error: "Order not found" });
      return;
    }
    res.json(order);
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function updateOrder(req: Request, res: Response): Promise<void> {
  try {
    const body = updateOrderSchema.parse(req.body);
    const tenantId = req.tenantContext!.tenantId;

    const existing = await db.query.salesOrders.findFirst({
      where: and(eq(salesOrders.id, req.params.orderId as string), eq(salesOrders.tenantId, tenantId)),
      with: { items: true },
    });

    if (!existing) {
      res.status(404).json({ error: "Order not found" });
      return;
    }

    const previousStatus = existing.status;

    // When confirming from draft, deduct stock
    if (body.status === "confirmed" && existing.status === "draft") {
      const variantTrackStockMap = await getTrackStockByVariantIds(existing.items.map((item) => item.variantId));
      for (const item of existing.items) {
        const trackStock = variantTrackStockMap.get(item.variantId) ?? true;
        if (!trackStock) continue;
        const [inv] = await db.select().from(inventory).where(and(eq(inventory.variantId, item.variantId), eq(inventory.branchId, existing.branchId)));
        if (!inv || inv.quantity < item.quantity) {
          res.status(400).json({ error: `Insufficient stock for ${item.productName} - ${item.variantName}` });
          return;
        }
        await db.update(inventory).set({ quantity: inv.quantity - item.quantity, updatedAt: new Date() }).where(eq(inventory.id, inv.id));
        await db.insert(stockMovements).values({
          tenantId,
          variantId: item.variantId,
          branchId: existing.branchId,
          type: "out",
          quantity: item.quantity,
          previousQuantity: inv.quantity,
          newQuantity: inv.quantity - item.quantity,
          referenceType: "sales_order",
          referenceId: existing.id,
          createdBy: req.user!.id,
        });
      }
    }

    const [order] = await db.update(salesOrders).set({ ...body, updatedAt: new Date() }).where(and(eq(salesOrders.id, req.params.orderId as string), eq(salesOrders.tenantId, tenantId))).returning();

    // Auto-record a sale transaction when order is first confirmed or delivered
    const saleStatuses = ["confirmed", "delivered"];
    if (body.status && saleStatuses.includes(body.status) && !saleStatuses.includes(previousStatus)) {
      await db.insert(transactions).values({
        tenantId,
        branchId: existing.branchId,
        type: "sale",
        amount: existing.totalAmount,
        description: `Sale — Order ${existing.orderNumber}${existing.customerName ? ` (${existing.customerName})` : ""}`,
        referenceType: "sales_order",
        referenceId: existing.id,
        createdBy: req.user!.id,
      });
    }

    await createAuditLog({ tenantId, userId: req.user!.id, action: "update", resourceType: "sales_order", resourceId: order.id });

    if (body.status && body.status !== previousStatus) {
      appEvents.emit("order.status_changed", {
        tenantId,
        orderId: order.id,
        orderNumber: order.orderNumber,
        previousStatus,
        newStatus: body.status,
      });
    }

    res.json(order);
  } catch (error) {
    handleControllerError(error, res);
  }
}

export async function deleteOrder(req: Request, res: Response): Promise<void> {
  try {
    const [order] = await db.select().from(salesOrders).where(and(eq(salesOrders.id, req.params.orderId as string), eq(salesOrders.tenantId, req.tenantContext!.tenantId)));
    if (!order) {
      res.status(404).json({ error: "Order not found" });
      return;
    }
    if (order.status !== "draft" && order.status !== "cancelled") {
      res.status(400).json({ error: "Only draft or cancelled orders can be deleted" });
      return;
    }
    await db.delete(salesOrders).where(eq(salesOrders.id, order.id));
    res.json({ message: "Order deleted" });
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function refundOrder(req: Request, res: Response): Promise<void> {
  try {
    const body = refundSchema.parse(req.body);
    const tenantId = req.tenantContext!.tenantId;

    const order = await db.query.salesOrders.findFirst({
      where: and(eq(salesOrders.id, req.params.orderId as string), eq(salesOrders.tenantId, tenantId)),
      with: { items: true },
    });

    if (!order) {
      res.status(404).json({ error: "Order not found" });
      return;
    }

    const validStatuses = ["confirmed", "processing", "shipped", "delivered"];
    if (!validStatuses.includes(order.status)) {
      res.status(400).json({ error: "Order cannot be refunded in current status" });
      return;
    }

    const [refund] = await db.insert(refunds).values({
      orderId: order.id,
      tenantId,
      amount: String(body.amount),
      reason: body.reason,
      processedBy: req.user!.id,
    }).returning();

    await db.update(salesOrders).set({ status: "refunded", updatedAt: new Date() }).where(eq(salesOrders.id, order.id));

    // Return stock for each item
    const variantTrackStockMap = await getTrackStockByVariantIds(order.items.map((item) => item.variantId));
    for (const item of order.items) {
      const trackStock = variantTrackStockMap.get(item.variantId) ?? true;
      if (!trackStock) continue;
      const [inv] = await db.select().from(inventory).where(and(eq(inventory.variantId, item.variantId), eq(inventory.branchId, order.branchId)));
      if (inv) {
        await db.update(inventory).set({ quantity: inv.quantity + item.quantity, updatedAt: new Date() }).where(eq(inventory.id, inv.id));
        await db.insert(stockMovements).values({
          tenantId,
          variantId: item.variantId,
          branchId: order.branchId,
          type: "return",
          quantity: item.quantity,
          previousQuantity: inv.quantity,
          newQuantity: inv.quantity + item.quantity,
          referenceType: "refund",
          referenceId: refund.id,
          createdBy: req.user!.id,
        });
      }
    }

    await createAuditLog({ tenantId, userId: req.user!.id, action: "create", resourceType: "refund", resourceId: refund.id });

    // Auto-record a refund transaction
    await db.insert(transactions).values({
      tenantId,
      branchId: order.branchId,
      type: "refund",
      amount: Number(body.amount).toFixed(2),
      description: `Refund — Order ${order.orderNumber}${order.customerName ? ` (${order.customerName})` : ""}`,
      referenceType: "refund",
      referenceId: refund.id,
      notes: body.reason ?? null,
      createdBy: req.user!.id,
    });

    res.status(201).json(refund);
  } catch (error) {
    handleControllerError(error, res);
  }
}
