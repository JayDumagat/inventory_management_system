import { Router, Request, Response } from "express";
import { z } from "zod";
import { db } from "../db";
import { salesOrders, salesOrderItems, inventory, stockMovements, refunds } from "../db/schema";
import { eq, and, desc } from "drizzle-orm";
import { authenticate, requireTenant } from "../middleware/auth";
import { createAuditLog } from "../middleware/auditLog";
import { appEvents } from "../lib/events";

const router = Router({ mergeParams: true });

const orderItemSchema = z.object({
  variantId: z.string().uuid(),
  productName: z.string(),
  variantName: z.string(),
  sku: z.string(),
  quantity: z.number().min(1),
  unitPrice: z.number().min(0),
});

const createOrderSchema = z.object({
  branchId: z.string().uuid(),
  customerName: z.string().optional(),
  customerEmail: z.string().email().optional(),
  customerPhone: z.string().optional(),
  items: z.array(orderItemSchema).min(1),
  taxAmount: z.number().min(0).optional().default(0),
  discountAmount: z.number().min(0).optional().default(0),
  notes: z.string().optional(),
});

function generateOrderNumber() {
  return `ORD-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
}

// GET /api/tenants/:tenantId/sales-orders
router.get("/", authenticate, requireTenant(), async (req: Request, res: Response): Promise<void> => {
  try {
    const orders = await db.query.salesOrders.findMany({
      where: eq(salesOrders.tenantId, req.tenantContext!.tenantId),
      with: { items: true, branch: true, refunds: true },
      orderBy: [desc(salesOrders.createdAt)],
    });
    res.json(orders);
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/tenants/:tenantId/sales-orders
router.post("/", authenticate, requireTenant("staff"), async (req: Request, res: Response): Promise<void> => {
  try {
    const body = createOrderSchema.parse(req.body);
    
    const subtotal = body.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
    const totalAmount = subtotal + (body.taxAmount || 0) - (body.discountAmount || 0);
    
    const [order] = await db.insert(salesOrders).values({
      tenantId: req.tenantContext!.tenantId,
      branchId: body.branchId,
      orderNumber: generateOrderNumber(),
      status: "draft",
      customerName: body.customerName,
      customerEmail: body.customerEmail,
      customerPhone: body.customerPhone,
      subtotal: String(subtotal),
      taxAmount: String(body.taxAmount || 0),
      discountAmount: String(body.discountAmount || 0),
      totalAmount: String(totalAmount),
      notes: body.notes,
      createdBy: req.user!.id,
    }).returning();
    
    const itemValues = body.items.map(item => ({
      orderId: order.id,
      variantId: item.variantId,
      productName: item.productName,
      variantName: item.variantName,
      sku: item.sku,
      quantity: item.quantity,
      unitPrice: String(item.unitPrice),
      totalPrice: String(item.quantity * item.unitPrice),
    }));
    
    const insertedItems = await db.insert(salesOrderItems).values(itemValues).returning();
    
    await createAuditLog({ tenantId: req.tenantContext!.tenantId, userId: req.user!.id, action: "create", resourceType: "sales_order", resourceId: order.id });

    appEvents.emit("order.created", {
      tenantId: req.tenantContext!.tenantId,
      orderId: order.id,
      orderNumber: order.orderNumber,
      totalAmount: totalAmount,
    });

    res.status(201).json({ ...order, items: insertedItems });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: "Validation failed", details: error.issues });
      return;
    }
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/tenants/:tenantId/sales-orders/:orderId
router.get("/:orderId", authenticate, requireTenant(), async (req: Request, res: Response): Promise<void> => {
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
});

// PATCH /api/tenants/:tenantId/sales-orders/:orderId - update status
router.patch("/:orderId", authenticate, requireTenant("staff"), async (req: Request, res: Response): Promise<void> => {
  try {
    const { status, notes } = z.object({
      status: z.enum(["draft", "confirmed", "processing", "shipped", "delivered", "cancelled", "refunded"]).optional(),
      notes: z.string().optional(),
    }).parse(req.body);
    
    const [order] = await db.select().from(salesOrders).where(and(eq(salesOrders.id, req.params.orderId as string), eq(salesOrders.tenantId, req.tenantContext!.tenantId)));
    if (!order) {
      res.status(404).json({ error: "Order not found" });
      return;
    }
    
    // When confirming order, deduct stock
    if (status === "confirmed" && order.status === "draft") {
      const items = await db.select().from(salesOrderItems).where(eq(salesOrderItems.orderId, order.id));
      for (const item of items) {
        const [inv] = await db.select().from(inventory).where(and(eq(inventory.variantId, item.variantId), eq(inventory.branchId, order.branchId)));
        if (!inv || inv.quantity < item.quantity) {
          res.status(400).json({ error: `Insufficient stock for item: ${item.variantName}` });
          return;
        }
        const newQty = inv.quantity - item.quantity;
        await db.update(inventory).set({ quantity: newQty, updatedAt: new Date() }).where(eq(inventory.id, inv.id));
        await db.insert(stockMovements).values({
          tenantId: req.tenantContext!.tenantId,
          variantId: item.variantId,
          branchId: order.branchId,
          type: "out",
          quantity: item.quantity,
          previousQuantity: inv.quantity,
          newQuantity: newQty,
          referenceType: "sales_order",
          referenceId: order.id,
          createdBy: req.user!.id,
        });
      }
    }
    
    const [updated] = await db.update(salesOrders).set({ status: status || order.status, notes: notes || order.notes, updatedAt: new Date() }).where(eq(salesOrders.id, order.id)).returning();
    
    await createAuditLog({ tenantId: req.tenantContext!.tenantId, userId: req.user!.id, action: "update", resourceType: "sales_order", resourceId: order.id, oldValues: { status: order.status }, newValues: { status } });

    if (status && status !== order.status) {
      appEvents.emit("order.status_changed", {
        tenantId: req.tenantContext!.tenantId,
        orderId: order.id,
        orderNumber: order.orderNumber,
        previousStatus: order.status,
        newStatus: status,
      });
    }

    res.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: "Validation failed", details: error.issues });
      return;
    }
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/tenants/:tenantId/sales-orders/:orderId - cancel/delete
router.delete("/:orderId", authenticate, requireTenant("manager"), async (req: Request, res: Response): Promise<void> => {
  try {
    const [order] = await db.select().from(salesOrders).where(and(eq(salesOrders.id, req.params.orderId as string), eq(salesOrders.tenantId, req.tenantContext!.tenantId)));
    if (!order) {
      res.status(404).json({ error: "Order not found" });
      return;
    }
    if (!["draft", "cancelled"].includes(order.status)) {
      res.status(400).json({ error: "Can only delete draft or cancelled orders" });
      return;
    }
    await db.delete(salesOrders).where(eq(salesOrders.id, order.id));
    res.json({ message: "Order deleted" });
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/tenants/:tenantId/sales-orders/:orderId/refund
router.post("/:orderId/refund", authenticate, requireTenant("manager"), async (req: Request, res: Response): Promise<void> => {
  try {
    const { amount, reason } = z.object({
      amount: z.number().min(0.01),
      reason: z.string().optional(),
    }).parse(req.body);
    
    const [order] = await db.select().from(salesOrders).where(and(eq(salesOrders.id, req.params.orderId as string), eq(salesOrders.tenantId, req.tenantContext!.tenantId)));
    if (!order) {
      res.status(404).json({ error: "Order not found" });
      return;
    }
    if (!["confirmed", "processing", "shipped", "delivered"].includes(order.status)) {
      res.status(400).json({ error: "Can only refund confirmed or completed orders" });
      return;
    }
    
    const [refund] = await db.insert(refunds).values({
      orderId: order.id,
      tenantId: req.tenantContext!.tenantId,
      amount: String(amount),
      reason,
      status: "completed",
      processedBy: req.user!.id,
    }).returning();
    
    // Update order status to refunded
    await db.update(salesOrders).set({ status: "refunded", updatedAt: new Date() }).where(eq(salesOrders.id, order.id));
    
    // Return stock
    const items = await db.select().from(salesOrderItems).where(eq(salesOrderItems.orderId, order.id));
    for (const item of items) {
      const [inv] = await db.select().from(inventory).where(and(eq(inventory.variantId, item.variantId), eq(inventory.branchId, order.branchId)));
      if (inv) {
        const newQty = inv.quantity + item.quantity;
        await db.update(inventory).set({ quantity: newQty, updatedAt: new Date() }).where(eq(inventory.id, inv.id));
        await db.insert(stockMovements).values({
          tenantId: req.tenantContext!.tenantId,
          variantId: item.variantId,
          branchId: order.branchId,
          type: "return",
          quantity: item.quantity,
          previousQuantity: inv.quantity,
          newQuantity: newQty,
          referenceType: "refund",
          referenceId: refund.id,
          createdBy: req.user!.id,
        });
      }
    }
    
    await createAuditLog({ tenantId: req.tenantContext!.tenantId, userId: req.user!.id, action: "create", resourceType: "refund", resourceId: refund.id });
    
    res.status(201).json(refund);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: "Validation failed", details: error.issues });
      return;
    }
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
