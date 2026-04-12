import { Router, Request, Response } from "express";
import { z } from "zod";
import { db } from "../db";
import { units } from "../db/schema";
import { eq, and } from "drizzle-orm";
import { authenticate, requireTenant } from "../middleware/auth";
import { createAuditLog } from "../middleware/auditLog";

const router = Router({ mergeParams: true });

const unitSchema = z.object({
  name: z.string().min(1),
  abbreviation: z.string().min(1),
});

// GET /api/tenants/:tenantId/units
router.get("/", authenticate, requireTenant(), async (req: Request, res: Response): Promise<void> => {
  try {
    const list = await db
      .select()
      .from(units)
      .where(eq(units.tenantId, req.tenantContext!.tenantId));
    res.json(list);
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/tenants/:tenantId/units
router.post("/", authenticate, requireTenant("manager"), async (req: Request, res: Response): Promise<void> => {
  try {
    const body = unitSchema.parse(req.body);
    const [unit] = await db
      .insert(units)
      .values({ ...body, tenantId: req.tenantContext!.tenantId })
      .returning();
    await createAuditLog({ tenantId: req.tenantContext!.tenantId, userId: req.user!.id, action: "create", resourceType: "unit", resourceId: unit.id });
    res.status(201).json(unit);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: "Validation failed", details: error.issues });
      return;
    }
    res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /api/tenants/:tenantId/units/:unitId
router.patch("/:unitId", authenticate, requireTenant("manager"), async (req: Request, res: Response): Promise<void> => {
  try {
    const body = unitSchema.partial().parse(req.body);
    const [unit] = await db
      .update(units)
      .set({ ...body, updatedAt: new Date() })
      .where(and(eq(units.id, req.params.unitId as string), eq(units.tenantId, req.tenantContext!.tenantId)))
      .returning();
    if (!unit) {
      res.status(404).json({ error: "Unit not found" });
      return;
    }
    res.json(unit);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: "Validation failed", details: error.issues });
      return;
    }
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/tenants/:tenantId/units/:unitId
router.delete("/:unitId", authenticate, requireTenant("manager"), async (req: Request, res: Response): Promise<void> => {
  try {
    const [unit] = await db
      .delete(units)
      .where(and(eq(units.id, req.params.unitId as string), eq(units.tenantId, req.tenantContext!.tenantId)))
      .returning();
    if (!unit) {
      res.status(404).json({ error: "Unit not found" });
      return;
    }
    await createAuditLog({ tenantId: req.tenantContext!.tenantId, userId: req.user!.id, action: "delete", resourceType: "unit", resourceId: unit.id });
    res.json({ message: "Unit deleted" });
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
