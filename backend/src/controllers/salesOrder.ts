import { Request, Response } from "express";
import { db } from "../db";
import { salesOrders, salesOrderItems, inventory, stockMovements, refunds } from "../db/schema";
import { eq, and, desc } from "drizzle-orm";
import { createAuditLog } from "../services/audit";
import { handleControllerError } from "../utils/errors";
import { createOrderSchema, updateOrderSchema, refundSchema } from "../validators/salesOrder";
import { generateSalesOrderNumber } from "../utils/helpers";
import { appEvents } from "../lib/events";

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

    const subtotal = body.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
    const totalAmount = subtotal + (body.taxAmount ?? 0) - (body.discountAmount ?? 0);

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

    // If the order is being immediately completed (POS sale), verify and deduct stock
    if (requestedStatus === "delivered" || requestedStatus === "confirmed") {
      for (const item of body.items) {
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
      orderNumber: generateSalesOrderNumber(),
      status: requestedStatus,
      customerName: body.customerName,
      customerEmail: body.customerEmail || undefined,
      customerPhone: body.customerPhone,
      subtotal: String(subtotal),
      taxAmount: String(body.taxAmount ?? 0),
      discountAmount: String(body.discountAmount ?? 0),
      totalAmount: String(totalAmount),
      notes,
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
      for (const item of existing.items) {
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
    for (const item of order.items) {
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

    res.status(201).json(refund);
  } catch (error) {
    handleControllerError(error, res);
  }
}
