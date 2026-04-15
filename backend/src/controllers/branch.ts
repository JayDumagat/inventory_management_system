import { Request, Response } from "express";
import { db } from "../db";
import { branches } from "../db/schema";
import { eq, and } from "drizzle-orm";
import { createAuditLog } from "../services/audit";
import { handleControllerError } from "../utils/errors";
import { branchSchema } from "../validators/branch";

export async function listBranches(req: Request, res: Response): Promise<void> {
  try {
    const list = await db.select().from(branches).where(eq(branches.tenantId, req.tenantContext!.tenantId));
    res.json(list);
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function createBranch(req: Request, res: Response): Promise<void> {
  try {
    const body = branchSchema.parse(req.body);
    const [branch] = await db.insert(branches).values({ ...body, tenantId: req.tenantContext!.tenantId }).returning();
    await createAuditLog({ tenantId: req.tenantContext!.tenantId, userId: req.user!.id, action: "create", resourceType: "branch", resourceId: branch.id });
    res.status(201).json(branch);
  } catch (error) {
    handleControllerError(error, res);
  }
}

export async function getBranch(req: Request, res: Response): Promise<void> {
  try {
    const [branch] = await db.select().from(branches).where(and(eq(branches.id, req.params.branchId as string), eq(branches.tenantId, req.tenantContext!.tenantId)));
    if (!branch) {
      res.status(404).json({ error: "Branch not found" });
      return;
    }
    res.json(branch);
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function updateBranch(req: Request, res: Response): Promise<void> {
  try {
    const body = branchSchema.partial().parse(req.body);
    const [branch] = await db.update(branches).set({ ...body, updatedAt: new Date() }).where(and(eq(branches.id, req.params.branchId as string), eq(branches.tenantId, req.tenantContext!.tenantId))).returning();
    if (!branch) {
      res.status(404).json({ error: "Branch not found" });
      return;
    }
    res.json(branch);
  } catch (error) {
    handleControllerError(error, res);
  }
}

export async function deleteBranch(req: Request, res: Response): Promise<void> {
  try {
    const [branch] = await db.delete(branches).where(and(eq(branches.id, req.params.branchId as string), eq(branches.tenantId, req.tenantContext!.tenantId))).returning();
    if (!branch) {
      res.status(404).json({ error: "Branch not found" });
      return;
    }
    await createAuditLog({ tenantId: req.tenantContext!.tenantId, userId: req.user!.id, action: "delete", resourceType: "branch", resourceId: branch.id });
    res.json({ message: "Branch deleted" });
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
}
