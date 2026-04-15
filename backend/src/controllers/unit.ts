import { Request, Response } from "express";
import { db } from "../db";
import { units } from "../db/schema";
import { eq, and } from "drizzle-orm";
import { createAuditLog } from "../services/audit";
import { handleControllerError } from "../utils/errors";
import { unitSchema } from "../validators/unit";

export const listUnits = async (req: Request, res: Response): Promise<void> => {
  try {
    const list = await db
      .select()
      .from(units)
      .where(eq(units.tenantId, req.tenantContext!.tenantId));
    res.json(list);
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
};

export const createUnit = async (req: Request, res: Response): Promise<void> => {
  try {
    const body = unitSchema.parse(req.body);
    const [unit] = await db
      .insert(units)
      .values({ ...body, tenantId: req.tenantContext!.tenantId })
      .returning();
    await createAuditLog({ tenantId: req.tenantContext!.tenantId, userId: req.user!.id, action: "create", resourceType: "unit", resourceId: unit.id });
    res.status(201).json(unit);
  } catch (error) {
    handleControllerError(error, res);
  }
};

export const updateUnit = async (req: Request, res: Response): Promise<void> => {
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
    handleControllerError(error, res);
  }
};

export const deleteUnit = async (req: Request, res: Response): Promise<void> => {
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
};
