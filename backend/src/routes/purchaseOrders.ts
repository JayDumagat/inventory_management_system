import { Router, Request, Response } from "express";
import { z } from "zod";
import { db } from "../db";
import { purchaseOrders, purchaseOrderItems, suppliers, branches } from "../db/schema";
import { eq, and } from "drizzle-orm";
import { authenticate, requireTenant } from "../middleware/auth";
import { createAuditLog } from "../middleware/auditLog";

const router = Router({ mergeParams: true });

const itemSchema = z.object({
  variantId: z.string().uuid().optional(),
  productName: z.string().min(1),
  variantName: z.string().min(1),
  sku: z.string().min(1),
  quantity: z.number().int().min(1),
  unitCost: z.number().min(0),
});

const createOrderSchema = z.object({
  supplierId: z.string().uuid().optional(),
  branchId: z.string().uuid().optional(),
  notes: z.string().optional(),
  taxAmount: z.number().min(0).optional(),
  expectedDate: z.string().optional(),
  items: z.array(itemSchema).min(1, "At least one item required"),
});

const updateOrderSchema = z.object({
  supplierId: z.string().uuid().optional().nullable(),
  branchId: z.string().uuid().optional().nullable(),
  notes: z.string().optional(),
  taxAmount: z.number().min(0).optional(),
  expectedDate: z.string().optional().nullable(),
  status: z.enum(["draft", "ordered", "partial", "received", "cancelled"]).optional(),
});

function generateOrderNumber(): string {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `PO-${ts}-${rand}`;
}

// GET /api/tenants/:tenantId/purchase-orders
router.get("/", authenticate, requireTenant(), async (req: Request, res: Response): Promise<void> => {
  try {
    const orders = await db
      .select({
        id: purchaseOrders.id,
        orderNumber: purchaseOrders.orderNumber,
        status: purchaseOrders.status,
        subtotal: purchaseOrders.subtotal,
        taxAmount: purchaseOrders.taxAmount,
        totalAmount: purchaseOrders.totalAmount,
        notes: purchaseOrders.notes,
        expectedDate: purchaseOrders.expectedDate,
        receivedAt: purchaseOrders.receivedAt,
        createdAt: purchaseOrders.createdAt,
        updatedAt: purchaseOrders.updatedAt,
        supplierName: suppliers.name,
        supplierId: purchaseOrders.supplierId,
        branchName: branches.name,
        branchId: purchaseOrders.branchId,
      })
      .from(purchaseOrders)
      .leftJoin(suppliers, eq(purchaseOrders.supplierId, suppliers.id))
      .leftJoin(branches, eq(purchaseOrders.branchId, branches.id))
      .where(eq(purchaseOrders.tenantId, req.tenantContext!.tenantId));
    res.json(orders);
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/tenants/:tenantId/purchase-orders/:orderId
router.get("/:orderId", authenticate, requireTenant(), async (req: Request, res: Response): Promise<void> => {
  try {
    const [order] = await db
      .select({
        id: purchaseOrders.id,
        orderNumber: purchaseOrders.orderNumber,
        status: purchaseOrders.status,
        subtotal: purchaseOrders.subtotal,
        taxAmount: purchaseOrders.taxAmount,
        totalAmount: purchaseOrders.totalAmount,
        notes: purchaseOrders.notes,
        expectedDate: purchaseOrders.expectedDate,
        receivedAt: purchaseOrders.receivedAt,
        createdAt: purchaseOrders.createdAt,
        updatedAt: purchaseOrders.updatedAt,
        supplierName: suppliers.name,
        supplierId: purchaseOrders.supplierId,
        branchName: branches.name,
        branchId: purchaseOrders.branchId,
      })
      .from(purchaseOrders)
      .leftJoin(suppliers, eq(purchaseOrders.supplierId, suppliers.id))
      .leftJoin(branches, eq(purchaseOrders.branchId, branches.id))
      .where(and(eq(purchaseOrders.id, req.params.orderId as string), eq(purchaseOrders.tenantId, req.tenantContext!.tenantId)));

    if (!order) {
      res.status(404).json({ error: "Purchase order not found" });
      return;
    }

    const items = await db
      .select()
      .from(purchaseOrderItems)
      .where(eq(purchaseOrderItems.purchaseOrderId, order.id));

    res.json({ ...order, items });
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/tenants/:tenantId/purchase-orders
router.post("/", authenticate, requireTenant("manager"), async (req: Request, res: Response): Promise<void> => {
  try {
    const body = createOrderSchema.parse(req.body);
    const subtotal = body.items.reduce((s, i) => s + i.quantity * i.unitCost, 0);
    const taxAmount = body.taxAmount ?? 0;
    const totalAmount = subtotal + taxAmount;

    const [order] = await db
      .insert(purchaseOrders)
      .values({
        tenantId: req.tenantContext!.tenantId,
        supplierId: body.supplierId ?? null,
        branchId: body.branchId ?? null,
        orderNumber: generateOrderNumber(),
        notes: body.notes,
        subtotal: subtotal.toFixed(2),
        taxAmount: taxAmount.toFixed(2),
        totalAmount: totalAmount.toFixed(2),
        expectedDate: body.expectedDate ?? null,
        createdBy: req.user!.id,
      })
      .returning();

    const itemRows = body.items.map((i) => ({
      purchaseOrderId: order.id,
      variantId: i.variantId ?? null,
      productName: i.productName,
      variantName: i.variantName,
      sku: i.sku,
      quantity: i.quantity,
      unitCost: i.unitCost.toFixed(2),
      totalCost: (i.quantity * i.unitCost).toFixed(2),
    }));

    await db.insert(purchaseOrderItems).values(itemRows);
    await createAuditLog({ tenantId: req.tenantContext!.tenantId, userId: req.user!.id, action: "create", resourceType: "purchase_order", resourceId: order.id });
    res.status(201).json(order);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: "Validation failed", details: error.issues });
      return;
    }
    res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /api/tenants/:tenantId/purchase-orders/:orderId
router.patch("/:orderId", authenticate, requireTenant("manager"), async (req: Request, res: Response): Promise<void> => {
  try {
    const body = updateOrderSchema.parse(req.body);
    const updateData: Record<string, unknown> = { ...body, updatedAt: new Date() };
    if (body.status === "received") updateData.receivedAt = new Date();

    const [order] = await db
      .update(purchaseOrders)
      .set(updateData)
      .where(and(eq(purchaseOrders.id, req.params.orderId as string), eq(purchaseOrders.tenantId, req.tenantContext!.tenantId)))
      .returning();

    if (!order) {
      res.status(404).json({ error: "Purchase order not found" });
      return;
    }
    await createAuditLog({ tenantId: req.tenantContext!.tenantId, userId: req.user!.id, action: "update", resourceType: "purchase_order", resourceId: order.id });
    res.json(order);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: "Validation failed", details: error.issues });
      return;
    }
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/tenants/:tenantId/purchase-orders/:orderId
router.delete("/:orderId", authenticate, requireTenant("manager"), async (req: Request, res: Response): Promise<void> => {
  try {
    const [order] = await db
      .delete(purchaseOrders)
      .where(and(eq(purchaseOrders.id, req.params.orderId as string), eq(purchaseOrders.tenantId, req.tenantContext!.tenantId)))
      .returning();
    if (!order) {
      res.status(404).json({ error: "Purchase order not found" });
      return;
    }
    await createAuditLog({ tenantId: req.tenantContext!.tenantId, userId: req.user!.id, action: "delete", resourceType: "purchase_order", resourceId: order.id });
    res.json({ message: "Purchase order deleted" });
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
