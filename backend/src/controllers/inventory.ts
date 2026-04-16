import { Request, Response } from "express";
import { db } from "../db";
import { inventory, stockMovements, productVariants, products, branches } from "../db/schema";
import { eq, and, desc } from "drizzle-orm";
import { createAuditLog } from "../services/audit";
import { handleControllerError } from "../utils/errors";
import { adjustStockSchema, setStockSchema, transferSchema } from "../validators/inventory";
import { cacheGet, cacheSet, cacheDelPattern } from "../lib/redis";
import { appEvents } from "../lib/events";

export async function listInventory(req: Request, res: Response): Promise<void> {
  try {
    const tenantId = req.tenantContext!.tenantId;
    const branchId = typeof req.query.branchId === "string" ? req.query.branchId : undefined;
    const cacheKey = `inventory:${tenantId}:list:${branchId ?? "all"}`;
    const cached = await cacheGet<unknown[]>(cacheKey);
    if (cached) {
      res.json(cached);
      return;
    }
    const all = await db.query.inventory.findMany({
      with: { variant: { with: { product: true } }, branch: true },
    });
    const filtered = all.filter((item) =>
      item.variant?.product?.tenantId === tenantId &&
      (!branchId || item.branchId === branchId),
    );
    await cacheSet(cacheKey, filtered, 30);
    res.json(filtered);
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function adjustStock(req: Request, res: Response): Promise<void> {
  try {
    const body = adjustStockSchema.parse(req.body);
    const tenantId = req.tenantContext!.tenantId;

    const [current] = await db.select().from(inventory).where(and(eq(inventory.variantId, body.variantId), eq(inventory.branchId, body.branchId)));

    let previousQty = current?.quantity ?? 0;
    let newQty = previousQty;

    switch (body.type) {
      case "in":
      case "return":
        newQty = previousQty + body.quantity;
        break;
      case "out":
        if (previousQty < body.quantity) {
          res.status(400).json({ error: "Insufficient stock" });
          return;
        }
        newQty = previousQty - body.quantity;
        break;
      case "adjustment":
        newQty = body.quantity;
        break;
      case "transfer":
        if (previousQty < body.quantity) {
          res.status(400).json({ error: "Insufficient stock" });
          return;
        }
        newQty = previousQty - body.quantity;
        break;
    }

    let inv: { id: string; quantity: number; reorderPoint: number };
    if (current) {
      const [updated] = await db.update(inventory).set({ quantity: newQty, updatedAt: new Date() }).where(eq(inventory.id, current.id)).returning();
      inv = updated;
    } else {
      const [inserted] = await db.insert(inventory).values({ variantId: body.variantId, branchId: body.branchId, quantity: newQty }).returning();
      inv = inserted;
    }

    await db.insert(stockMovements).values({
      tenantId,
      variantId: body.variantId,
      branchId: body.branchId,
      type: body.type,
      quantity: body.quantity,
      previousQuantity: previousQty,
      newQuantity: newQty,
      referenceType: body.referenceType,
      referenceId: body.referenceId,
      notes: body.notes,
      createdBy: req.user!.id,
    });

    await createAuditLog({ tenantId, userId: req.user!.id, action: "update", resourceType: "inventory", resourceId: inv.id });

    appEvents.emit("inventory.stock_movement", {
      tenantId,
      variantId: body.variantId,
      branchId: body.branchId,
      type: body.type,
      quantity: body.quantity,
      referenceId: body.referenceId,
    });

    if (inv.reorderPoint && inv.quantity <= inv.reorderPoint) {
      const variant = await db.query.productVariants.findFirst({
        where: eq(productVariants.id, body.variantId),
        with: { product: true },
      });
      const branch = await db.query.branches.findFirst({
        where: eq(branches.id, body.branchId),
      });
      if (variant?.product) {
        appEvents.emit("inventory.low_stock", {
          tenantId: req.tenantContext!.tenantId,
          variantId: body.variantId,
          productName: variant.product.name,
          variantName: variant.name,
          sku: variant.sku,
          branchId: body.branchId,
          branchName: branch?.name ?? body.branchId,
          quantity: inv.quantity,
          reorderPoint: inv.reorderPoint,
        });
      }
    }

    await cacheDelPattern(`inventory:${tenantId}:*`);
    res.json(inv);
  } catch (error) {
    handleControllerError(error, res);
  }
}

export async function setStock(req: Request, res: Response): Promise<void> {
  try {
    const body = setStockSchema.parse(req.body);
    const tenantId = req.tenantContext!.tenantId;

    const [current] = await db.select().from(inventory).where(and(eq(inventory.variantId, body.variantId), eq(inventory.branchId, body.branchId)));

    const previousQty = current?.quantity ?? 0;

    let inv;
    if (current) {
      const [updated] = await db.update(inventory).set({
        quantity: body.quantity,
        reorderPoint: body.reorderPoint ?? current.reorderPoint,
        updatedAt: new Date(),
      }).where(eq(inventory.id, current.id)).returning();
      inv = updated;
    } else {
      const [inserted] = await db.insert(inventory).values({
        variantId: body.variantId,
        branchId: body.branchId,
        quantity: body.quantity,
        reorderPoint: body.reorderPoint ?? 0,
      }).returning();
      inv = inserted;
    }

    await db.insert(stockMovements).values({
      tenantId,
      variantId: body.variantId,
      branchId: body.branchId,
      type: "adjustment",
      quantity: body.quantity,
      previousQuantity: previousQty,
      newQuantity: body.quantity,
      notes: "Stock level set manually",
      createdBy: req.user!.id,
    });

    appEvents.emit("inventory.stock_movement", {
      tenantId,
      variantId: body.variantId,
      branchId: body.branchId,
      type: "adjustment",
      quantity: body.quantity,
    });

    await cacheDelPattern(`inventory:${tenantId}:*`);
    res.json(inv);
  } catch (error) {
    handleControllerError(error, res);
  }
}

export async function listMovements(req: Request, res: Response): Promise<void> {
  try {
    const branchId = typeof req.query.branchId === "string" ? req.query.branchId : undefined;
    const whereCondition = branchId
      ? and(eq(stockMovements.tenantId, req.tenantContext!.tenantId), eq(stockMovements.branchId, branchId))
      : eq(stockMovements.tenantId, req.tenantContext!.tenantId);
    const movements = await db.select().from(stockMovements)
      .where(whereCondition)
      .orderBy(desc(stockMovements.createdAt))
      .limit(100);
    res.json(movements);
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function transferStock(req: Request, res: Response): Promise<void> {
  try {
    const body = transferSchema.parse(req.body);
    const tenantId = req.tenantContext!.tenantId;

    if (body.fromBranchId === body.toBranchId) {
      res.status(400).json({ error: "Cannot transfer to the same branch" });
      return;
    }

    const [source] = await db.select().from(inventory).where(and(eq(inventory.variantId, body.variantId), eq(inventory.branchId, body.fromBranchId)));

    if (!source || source.quantity < body.quantity) {
      res.status(400).json({ error: "Insufficient stock at source branch" });
      return;
    }

    // Update source
    await db.update(inventory).set({ quantity: source.quantity - body.quantity, updatedAt: new Date() }).where(eq(inventory.id, source.id));

    // Update destination
    const [dest] = await db.select().from(inventory).where(and(eq(inventory.variantId, body.variantId), eq(inventory.branchId, body.toBranchId)));
    if (dest) {
      await db.update(inventory).set({ quantity: dest.quantity + body.quantity, updatedAt: new Date() }).where(eq(inventory.id, dest.id));
    } else {
      await db.insert(inventory).values({ variantId: body.variantId, branchId: body.toBranchId, quantity: body.quantity });
    }

    // Record stock movements
    await db.insert(stockMovements).values({
      tenantId,
      variantId: body.variantId,
      branchId: body.fromBranchId,
      destinationBranchId: body.toBranchId,
      type: "transfer",
      quantity: body.quantity,
      previousQuantity: source.quantity,
      newQuantity: source.quantity - body.quantity,
      notes: body.notes,
      createdBy: req.user!.id,
    });

    await db.insert(stockMovements).values({
      tenantId,
      variantId: body.variantId,
      branchId: body.toBranchId,
      type: "in",
      quantity: body.quantity,
      previousQuantity: dest?.quantity ?? 0,
      newQuantity: (dest?.quantity ?? 0) + body.quantity,
      notes: body.notes,
      createdBy: req.user!.id,
    });

    await createAuditLog({ tenantId, userId: req.user!.id, action: "update", resourceType: "inventory_transfer", resourceId: body.variantId });

    appEvents.emit("inventory.stock_movement", {
      tenantId,
      variantId: body.variantId,
      branchId: body.fromBranchId,
      type: "transfer",
      quantity: body.quantity,
    });

    await cacheDelPattern(`inventory:${tenantId}:*`);
    res.json({ message: "Transfer completed" });
  } catch (error) {
    handleControllerError(error, res);
  }
}

export async function lookupBarcode(req: Request, res: Response): Promise<void> {
  try {
    const variant = await db.query.productVariants.findFirst({
      where: eq(productVariants.barcode, req.params.code as string),
      with: { product: true, inventory: { with: { branch: true } } },
    });
    if (!variant || (variant.product as { tenantId: string })?.tenantId !== req.tenantContext!.tenantId) {
      res.status(404).json({ error: "Product not found" });
      return;
    }
    res.json(variant);
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
}
