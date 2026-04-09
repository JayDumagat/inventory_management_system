import { Router, Request, Response } from "express";
import { z } from "zod";
import { db } from "../db";
import { branches } from "../db/schema";
import { eq, and } from "drizzle-orm";
import { authenticate, requireTenant } from "../middleware/auth";
import { createAuditLog } from "../middleware/auditLog";

const router = Router({ mergeParams: true });

const branchSchema = z.object({
  name: z.string().min(1),
  address: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
  phone: z.string().optional(),
  isDefault: z.boolean().optional(),
});

router.get("/", authenticate, requireTenant(), async (req: Request, res: Response): Promise<void> => {
  try {
    const list = await db.select().from(branches).where(eq(branches.tenantId, req.tenantContext!.tenantId));
    res.json(list);
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/", authenticate, requireTenant("manager"), async (req: Request, res: Response): Promise<void> => {
  try {
    const body = branchSchema.parse(req.body);
    const [branch] = await db.insert(branches).values({ ...body, tenantId: req.tenantContext!.tenantId }).returning();
    await createAuditLog({ tenantId: req.tenantContext!.tenantId, userId: req.user!.id, action: "create", resourceType: "branch", resourceId: branch.id });
    res.status(201).json(branch);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: "Validation failed", details: error.issues });
      return;
    }
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/:branchId", authenticate, requireTenant(), async (req: Request, res: Response): Promise<void> => {
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
});

router.patch("/:branchId", authenticate, requireTenant("manager"), async (req: Request, res: Response): Promise<void> => {
  try {
    const body = branchSchema.partial().parse(req.body);
    const [branch] = await db.update(branches).set({ ...body, updatedAt: new Date() }).where(and(eq(branches.id, req.params.branchId as string), eq(branches.tenantId, req.tenantContext!.tenantId))).returning();
    if (!branch) {
      res.status(404).json({ error: "Branch not found" });
      return;
    }
    res.json(branch);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: "Validation failed", details: error.issues });
      return;
    }
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/:branchId", authenticate, requireTenant("admin"), async (req: Request, res: Response): Promise<void> => {
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
});

export default router;
