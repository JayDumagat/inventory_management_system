import { Router, Request, Response } from "express";
import { z } from "zod";
import { db } from "../db";
import { inventory, stockMovements } from "../db/schema";
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

export default router;
