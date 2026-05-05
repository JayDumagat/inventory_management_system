import { Request, Response } from "express";
import { db } from "../db";
import { purchaseOrders, purchaseOrderItems, suppliers, branches, transactions, productVariants, products, productBatches } from "../db/schema";
import { eq, and } from "drizzle-orm";
import { createAuditLog } from "../services/audit";
import { handleControllerError } from "../utils/errors";
import { createPurchaseOrderSchema, updatePurchaseOrderSchema } from "../validators/purchaseOrder";
import { generatePurchaseOrderNumber } from "../utils/helpers";

export const listPurchaseOrders = async (req: Request, res: Response): Promise<void> => {
  try {
    const branchId = typeof req.query.branchId === "string" ? req.query.branchId : undefined;
    const whereCondition = branchId
      ? and(eq(purchaseOrders.tenantId, req.tenantContext!.tenantId), eq(purchaseOrders.branchId, branchId))
      : eq(purchaseOrders.tenantId, req.tenantContext!.tenantId);
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
      .where(whereCondition);
    res.json(orders);
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
};

export const getPurchaseOrder = async (req: Request, res: Response): Promise<void> => {
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
};

export const createPurchaseOrder = async (req: Request, res: Response): Promise<void> => {
  try {
    const body = createPurchaseOrderSchema.parse(req.body);
    const tenantId = req.tenantContext!.tenantId;
    const subtotal = body.items.reduce((s, i) => s + i.quantity * i.unitCost, 0);
    const taxAmount = body.taxAmount ?? 0;
    const totalAmount = subtotal + taxAmount;

    const [order] = await db
      .insert(purchaseOrders)
      .values({
        tenantId,
        supplierId: body.supplierId ?? null,
        branchId: body.branchId ?? null,
        orderNumber: await generatePurchaseOrderNumber(tenantId),
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
    await createAuditLog({ tenantId, userId: req.user!.id, action: "create", resourceType: "purchase_order", resourceId: order.id });
    res.status(201).json(order);
  } catch (error) {
    handleControllerError(error, res);
  }
};

export const updatePurchaseOrder = async (req: Request, res: Response): Promise<void> => {
  try {
    const body = updatePurchaseOrderSchema.parse(req.body);
    const tenantId = req.tenantContext!.tenantId;

    // Fetch existing order before update to know previous status and amount
    const [existing] = await db
      .select()
      .from(purchaseOrders)
      .where(and(eq(purchaseOrders.id, req.params.orderId as string), eq(purchaseOrders.tenantId, tenantId)));

    if (!existing) {
      res.status(404).json({ error: "Purchase order not found" });
      return;
    }

    const updateData: Record<string, unknown> = { ...body, updatedAt: new Date() };
    if (body.status === "received") updateData.receivedAt = new Date();

    const [order] = await db
      .update(purchaseOrders)
      .set(updateData)
      .where(and(eq(purchaseOrders.id, req.params.orderId as string), eq(purchaseOrders.tenantId, tenantId)))
      .returning();

    if (!order) {
      res.status(404).json({ error: "Purchase order not found" });
      return;
    }

    // Auto-record a purchase transaction + auto-create batches when first marked as received
    if (body.status === "received" && existing.status !== "received") {
      await db.insert(transactions).values({
        tenantId,
        branchId: existing.branchId,
        type: "purchase",
        amount: existing.totalAmount,
        description: `Purchase — PO ${existing.orderNumber}`,
        referenceType: "purchase_order",
        referenceId: existing.id,
        createdBy: req.user!.id,
      });

      // Auto batch creation for perishable products
      if (existing.branchId) {
        const items = await db
          .select()
          .from(purchaseOrderItems)
          .where(eq(purchaseOrderItems.purchaseOrderId, existing.id));

        for (const item of items) {
          if (!item.variantId) continue;
          // Check if the product is perishable
          const [variant] = await db
            .select({ productId: productVariants.productId })
            .from(productVariants)
            .where(eq(productVariants.id, item.variantId));
          if (!variant) continue;

          const [product] = await db
            .select({ isPerishable: products.isPerishable })
            .from(products)
            .where(eq(products.id, variant.productId));

          if (product?.isPerishable) {
            const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
            const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
            const batchNumber = `BATCH-${dateStr}-${rand}`;
            await db.insert(productBatches).values({
              tenantId,
              variantId: item.variantId,
              branchId: existing.branchId,
              batchNumber,
              quantity: item.receivedQuantity > 0 ? item.receivedQuantity : item.quantity,
              createdBy: req.user!.id,
            }).catch(() => {}); // non-fatal
          }
        }
      }
    }

    await createAuditLog({ tenantId, userId: req.user!.id, action: "update", resourceType: "purchase_order", resourceId: order.id });
    res.json(order);
  } catch (error) {
    handleControllerError(error, res);
  }
};

export const deletePurchaseOrder = async (req: Request, res: Response): Promise<void> => {
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
};
