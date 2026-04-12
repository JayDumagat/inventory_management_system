import { Router, Request, Response } from "express";
import { z } from "zod";
import { db } from "../db";
import { productBatches, productVariants, products, branches } from "../db/schema";
import { eq, and } from "drizzle-orm";
import { authenticate, requireTenant } from "../middleware/auth";
import { createAuditLog } from "../middleware/auditLog";

const router = Router({ mergeParams: true });

const batchSchema = z.object({
  variantId: z.string().uuid(),
  branchId: z.string().uuid(),
  batchNumber: z.string().min(1),
  quantity: z.number().int().min(0),
  expiryDate: z.string().optional().nullable(),
  manufacturingDate: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

// GET /api/tenants/:tenantId/batches
router.get("/", authenticate, requireTenant(), async (req: Request, res: Response): Promise<void> => {
  try {
    const list = await db.query.productBatches.findMany({
      where: eq(productBatches.tenantId, req.tenantContext!.tenantId),
      with: {
        variant: { with: { product: true } },
        branch: true,
      },
      orderBy: (b, { asc }) => [asc(b.expiryDate)],
    });
    res.json(list);
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/tenants/:tenantId/batches
router.post("/", authenticate, requireTenant("manager"), async (req: Request, res: Response): Promise<void> => {
  try {
    const body = batchSchema.parse(req.body);

    // Verify variant belongs to tenant
    const variant = await db.query.productVariants.findFirst({
      where: eq(productVariants.id, body.variantId),
      with: { product: true },
    });
    if (!variant || (variant.product as { tenantId: string })?.tenantId !== req.tenantContext!.tenantId) {
      res.status(404).json({ error: "Variant not found" });
      return;
    }

    // Verify branch belongs to tenant
    const [branch] = await db
      .select()
      .from(branches)
      .where(and(eq(branches.id, body.branchId), eq(branches.tenantId, req.tenantContext!.tenantId)));
    if (!branch) {
      res.status(404).json({ error: "Branch not found" });
      return;
    }

    const [batch] = await db
      .insert(productBatches)
      .values({
        ...body,
        tenantId: req.tenantContext!.tenantId,
        createdBy: req.user!.id,
      })
      .returning();

    await createAuditLog({ tenantId: req.tenantContext!.tenantId, userId: req.user!.id, action: "create", resourceType: "batch", resourceId: batch.id });
    res.status(201).json(batch);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: "Validation failed", details: error.issues });
      return;
    }
    res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /api/tenants/:tenantId/batches/:batchId
router.patch("/:batchId", authenticate, requireTenant("manager"), async (req: Request, res: Response): Promise<void> => {
  try {
    const body = batchSchema.partial().parse(req.body);
    const [batch] = await db
      .update(productBatches)
      .set({ ...body, updatedAt: new Date() })
      .where(and(eq(productBatches.id, req.params.batchId as string), eq(productBatches.tenantId, req.tenantContext!.tenantId)))
      .returning();
    if (!batch) {
      res.status(404).json({ error: "Batch not found" });
      return;
    }
    res.json(batch);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: "Validation failed", details: error.issues });
      return;
    }
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/tenants/:tenantId/batches/:batchId
router.delete("/:batchId", authenticate, requireTenant("manager"), async (req: Request, res: Response): Promise<void> => {
  try {
    const [batch] = await db
      .delete(productBatches)
      .where(and(eq(productBatches.id, req.params.batchId as string), eq(productBatches.tenantId, req.tenantContext!.tenantId)))
      .returning();
    if (!batch) {
      res.status(404).json({ error: "Batch not found" });
      return;
    }
    await createAuditLog({ tenantId: req.tenantContext!.tenantId, userId: req.user!.id, action: "delete", resourceType: "batch", resourceId: batch.id });
    res.json({ message: "Batch deleted" });
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
