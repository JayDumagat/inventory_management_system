import { Router, Request, Response } from "express";
import { z } from "zod";
import { db } from "../db";
import { inventory, stockMovements, productVariants, products } from "../db/schema";
import { eq, and, desc } from "drizzle-orm";
import { authenticate, requireTenant } from "../middleware/auth";
import { createAuditLog } from "../middleware/auditLog";

const router = Router({ mergeParams: true });

const adjustStockSchema = z.object({
  variantId: z.string().uuid(),
  branchId: z.string().uuid(),
  quantity: z.number().int(),
  type: z.enum(["in", "out", "adjustment", "transfer", "return"]),
  notes: z.string().optional(),
  referenceType: z.string().optional(),
  referenceId: z.string().uuid().optional(),
});

const setStockSchema = z.object({
  variantId: z.string().uuid(),
  branchId: z.string().uuid(),
  quantity: z.number().int().min(0),
  reorderPoint: z.number().int().min(0).optional(),
});

const transferSchema = z.object({
  variantId: z.string().uuid(),
  fromBranchId: z.string().uuid(),
  toBranchId: z.string().uuid(),
  quantity: z.number().int().min(1),
  notes: z.string().optional(),
});

// GET /api/tenants/:tenantId/inventory - list all inventory
router.get("/", authenticate, requireTenant(), async (req: Request, res: Response): Promise<void> => {
  try {
    const list = await db.query.inventory.findMany({
      with: {
        variant: { with: { product: true } },
        branch: true,
      },
    });
    // Filter by tenant through product.tenantId
    const filtered = list.filter(item => item.variant?.product?.tenantId === req.tenantContext!.tenantId);
    res.json(filtered);
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/tenants/:tenantId/inventory/adjust - adjust stock
router.post("/adjust", authenticate, requireTenant("manager"), async (req: Request, res: Response): Promise<void> => {
  try {
    const body = adjustStockSchema.parse(req.body);
    
    // Get current inventory
    let [inv] = await db.select().from(inventory).where(and(eq(inventory.variantId, body.variantId), eq(inventory.branchId, body.branchId)));
    
    const previousQty = inv?.quantity ?? 0;
    let newQty = previousQty;
    
    if (body.type === "in" || body.type === "return") {
      newQty = previousQty + body.quantity;
    } else if (body.type === "out") {
      newQty = previousQty - body.quantity;
      if (newQty < 0) {
        res.status(400).json({ error: "Insufficient stock" });
        return;
      }
    } else if (body.type === "adjustment") {
      newQty = body.quantity;
    } else if (body.type === "transfer") {
      newQty = previousQty - body.quantity;
      if (newQty < 0) {
        res.status(400).json({ error: "Insufficient stock for transfer" });
        return;
      }
    }
    
    if (inv) {
      [inv] = await db.update(inventory).set({ quantity: newQty, updatedAt: new Date() }).where(eq(inventory.id, inv.id)).returning();
    } else {
      [inv] = await db.insert(inventory).values({ variantId: body.variantId, branchId: body.branchId, quantity: newQty }).returning();
    }
    
    // Record movement
    const [movement] = await db.insert(stockMovements).values({
      tenantId: req.tenantContext!.tenantId,
      variantId: body.variantId,
      branchId: body.branchId,
      type: body.type,
      quantity: body.quantity,
      previousQuantity: previousQty,
      newQuantity: newQty,
      notes: body.notes,
      referenceType: body.referenceType,
      referenceId: body.referenceId,
      createdBy: req.user!.id,
    }).returning();
    
    await createAuditLog({ tenantId: req.tenantContext!.tenantId, userId: req.user!.id, action: "update", resourceType: "inventory", resourceId: inv.id });
    
    res.json({ inventory: inv, movement });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: "Validation failed", details: error.issues });
      return;
    }
    res.status(500).json({ error: "Internal server error" });
  }
});

// PUT /api/tenants/:tenantId/inventory/set - set stock level
router.put("/set", authenticate, requireTenant("manager"), async (req: Request, res: Response): Promise<void> => {
  try {
    const body = setStockSchema.parse(req.body);
    
    let [inv] = await db.select().from(inventory).where(and(eq(inventory.variantId, body.variantId), eq(inventory.branchId, body.branchId)));
    const previousQty = inv?.quantity ?? 0;
    
    if (inv) {
      [inv] = await db.update(inventory).set({ quantity: body.quantity, reorderPoint: body.reorderPoint ?? inv.reorderPoint, updatedAt: new Date() }).where(eq(inventory.id, inv.id)).returning();
    } else {
      [inv] = await db.insert(inventory).values({ variantId: body.variantId, branchId: body.branchId, quantity: body.quantity, reorderPoint: body.reorderPoint }).returning();
    }
    
    await db.insert(stockMovements).values({
      tenantId: req.tenantContext!.tenantId,
      variantId: body.variantId,
      branchId: body.branchId,
      type: "adjustment",
      quantity: Math.abs(body.quantity - previousQty),
      previousQuantity: previousQty,
      newQuantity: body.quantity,
      createdBy: req.user!.id,
    });
    
    res.json(inv);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: "Validation failed", details: error.issues });
      return;
    }
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/tenants/:tenantId/inventory/movements - stock movements
router.get("/movements", authenticate, requireTenant(), async (req: Request, res: Response): Promise<void> => {
  try {
    const movements = await db
      .select()
      .from(stockMovements)
      .where(eq(stockMovements.tenantId, req.tenantContext!.tenantId))
      .orderBy(desc(stockMovements.createdAt))
      .limit(100);
    res.json(movements);
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/tenants/:tenantId/inventory/transfer - interbranch transfer
router.post("/transfer", authenticate, requireTenant("manager"), async (req: Request, res: Response): Promise<void> => {
  try {
    const body = transferSchema.parse(req.body);

    if (body.fromBranchId === body.toBranchId) {
      res.status(400).json({ error: "Source and destination branches must be different" });
      return;
    }

    // Get source inventory
    let [srcInv] = await db
      .select()
      .from(inventory)
      .where(and(eq(inventory.variantId, body.variantId), eq(inventory.branchId, body.fromBranchId)));

    const srcPreviousQty = srcInv?.quantity ?? 0;
    if (srcPreviousQty < body.quantity) {
      res.status(400).json({ error: "Insufficient stock in source branch" });
      return;
    }

    const srcNewQty = srcPreviousQty - body.quantity;

    // Get destination inventory
    let [dstInv] = await db
      .select()
      .from(inventory)
      .where(and(eq(inventory.variantId, body.variantId), eq(inventory.branchId, body.toBranchId)));

    const dstPreviousQty = dstInv?.quantity ?? 0;
    const dstNewQty = dstPreviousQty + body.quantity;

    // Update source inventory
    if (srcInv) {
      [srcInv] = await db
        .update(inventory)
        .set({ quantity: srcNewQty, updatedAt: new Date() })
        .where(eq(inventory.id, srcInv.id))
        .returning();
    } else {
      [srcInv] = await db
        .insert(inventory)
        .values({ variantId: body.variantId, branchId: body.fromBranchId, quantity: srcNewQty })
        .returning();
    }

    // Update destination inventory
    if (dstInv) {
      [dstInv] = await db
        .update(inventory)
        .set({ quantity: dstNewQty, updatedAt: new Date() })
        .where(eq(inventory.id, dstInv.id))
        .returning();
    } else {
      [dstInv] = await db
        .insert(inventory)
        .values({ variantId: body.variantId, branchId: body.toBranchId, quantity: dstNewQty })
        .returning();
    }

    // Record outgoing movement at source
    await db.insert(stockMovements).values({
      tenantId: req.tenantContext!.tenantId,
      variantId: body.variantId,
      branchId: body.fromBranchId,
      destinationBranchId: body.toBranchId,
      type: "transfer",
      quantity: body.quantity,
      previousQuantity: srcPreviousQty,
      newQuantity: srcNewQty,
      notes: body.notes,
      referenceType: "transfer",
      createdBy: req.user!.id,
    });

    // Record incoming movement at destination
    await db.insert(stockMovements).values({
      tenantId: req.tenantContext!.tenantId,
      variantId: body.variantId,
      branchId: body.toBranchId,
      destinationBranchId: body.fromBranchId,
      type: "in",
      quantity: body.quantity,
      previousQuantity: dstPreviousQty,
      newQuantity: dstNewQty,
      notes: body.notes,
      referenceType: "transfer",
      createdBy: req.user!.id,
    });

    await createAuditLog({
      tenantId: req.tenantContext!.tenantId,
      userId: req.user!.id,
      action: "update",
      resourceType: "inventory_transfer",
      newValues: { variantId: body.variantId, fromBranchId: body.fromBranchId, toBranchId: body.toBranchId, quantity: body.quantity },
    });

    res.json({ source: srcInv, destination: dstInv });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: "Validation failed", details: error.issues });
      return;
    }
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/tenants/:tenantId/inventory/barcode/:code - lookup by barcode
router.get("/barcode/:code", authenticate, requireTenant(), async (req: Request, res: Response): Promise<void> => {
  try {
    const code = req.params.code as string;
    const variant = await db.query.productVariants.findFirst({
      where: eq(productVariants.barcode, code),
      with: {
        product: true,
        inventory: { with: { branch: true } },
      },
    });

    if (!variant || (variant.product as { tenantId: string })?.tenantId !== req.tenantContext!.tenantId) {
      res.status(404).json({ error: "No product found with that barcode" });
      return;
    }

    res.json(variant);
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
