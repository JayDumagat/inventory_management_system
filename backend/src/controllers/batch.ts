import { Request, Response } from "express";
import { db } from "../db";
import { productBatches, productVariants, branches } from "../db/schema";
import { eq, and } from "drizzle-orm";
import { createAuditLog } from "../services/audit";
import { handleControllerError } from "../utils/errors";
import { batchSchema } from "../validators/batch";

export const listBatches = async (req: Request, res: Response): Promise<void> => {
  try {
    const branchId = typeof req.query.branchId === "string" ? req.query.branchId : undefined;
    const whereCondition = branchId
      ? and(eq(productBatches.tenantId, req.tenantContext!.tenantId), eq(productBatches.branchId, branchId))
      : eq(productBatches.tenantId, req.tenantContext!.tenantId);
    const list = await db.query.productBatches.findMany({
      where: whereCondition,
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
};

export const createBatch = async (req: Request, res: Response): Promise<void> => {
  try {
    const body = batchSchema.parse(req.body);

    const variant = await db.query.productVariants.findFirst({
      where: eq(productVariants.id, body.variantId),
      with: { product: true },
    });
    if (!variant || (variant.product as { tenantId: string })?.tenantId !== req.tenantContext!.tenantId) {
      res.status(404).json({ error: "Variant not found" });
      return;
    }

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
    handleControllerError(error, res);
  }
};

export const updateBatch = async (req: Request, res: Response): Promise<void> => {
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
    handleControllerError(error, res);
  }
};

export const deleteBatch = async (req: Request, res: Response): Promise<void> => {
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
};
