import { Request, Response } from "express";
import { db } from "../db";
import { suppliers } from "../db/schema";
import { eq, and } from "drizzle-orm";
import { createAuditLog } from "../services/audit";
import { handleControllerError } from "../utils/errors";
import { supplierSchema } from "../validators/supplier";

export const listSuppliers = async (req: Request, res: Response): Promise<void> => {
  try {
    const list = await db
      .select()
      .from(suppliers)
      .where(eq(suppliers.tenantId, req.tenantContext!.tenantId));
    res.json(list);
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
};

export const getSupplier = async (req: Request, res: Response): Promise<void> => {
  try {
    const [supplier] = await db
      .select()
      .from(suppliers)
      .where(and(eq(suppliers.id, req.params.supplierId as string), eq(suppliers.tenantId, req.tenantContext!.tenantId)));
    if (!supplier) {
      res.status(404).json({ error: "Supplier not found" });
      return;
    }
    res.json(supplier);
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
};

export const createSupplier = async (req: Request, res: Response): Promise<void> => {
  try {
    const body = supplierSchema.parse(req.body);
    const [supplier] = await db
      .insert(suppliers)
      .values({ ...body, tenantId: req.tenantContext!.tenantId })
      .returning();
    await createAuditLog({ tenantId: req.tenantContext!.tenantId, userId: req.user!.id, action: "create", resourceType: "supplier", resourceId: supplier.id });
    res.status(201).json(supplier);
  } catch (error) {
    handleControllerError(error, res);
  }
};

export const updateSupplier = async (req: Request, res: Response): Promise<void> => {
  try {
    const body = supplierSchema.partial().parse(req.body);
    const [supplier] = await db
      .update(suppliers)
      .set({ ...body, updatedAt: new Date() })
      .where(and(eq(suppliers.id, req.params.supplierId as string), eq(suppliers.tenantId, req.tenantContext!.tenantId)))
      .returning();
    if (!supplier) {
      res.status(404).json({ error: "Supplier not found" });
      return;
    }
    await createAuditLog({ tenantId: req.tenantContext!.tenantId, userId: req.user!.id, action: "update", resourceType: "supplier", resourceId: supplier.id });
    res.json(supplier);
  } catch (error) {
    handleControllerError(error, res);
  }
};

export const deleteSupplier = async (req: Request, res: Response): Promise<void> => {
  try {
    const [supplier] = await db
      .delete(suppliers)
      .where(and(eq(suppliers.id, req.params.supplierId as string), eq(suppliers.tenantId, req.tenantContext!.tenantId)))
      .returning();
    if (!supplier) {
      res.status(404).json({ error: "Supplier not found" });
      return;
    }
    await createAuditLog({ tenantId: req.tenantContext!.tenantId, userId: req.user!.id, action: "delete", resourceType: "supplier", resourceId: supplier.id });
    res.json({ message: "Supplier deleted" });
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
};
