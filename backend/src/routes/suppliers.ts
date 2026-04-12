import { Router, Request, Response } from "express";
import { z } from "zod";
import { db } from "../db";
import { suppliers } from "../db/schema";
import { eq, and } from "drizzle-orm";
import { authenticate, requireTenant } from "../middleware/auth";
import { createAuditLog } from "../middleware/auditLog";

const router = Router({ mergeParams: true });

const supplierSchema = z.object({
  name: z.string().min(1),
  contactName: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  website: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
  notes: z.string().optional(),
  isActive: z.boolean().optional(),
});

// GET /api/tenants/:tenantId/suppliers
router.get("/", authenticate, requireTenant(), async (req: Request, res: Response): Promise<void> => {
  try {
    const list = await db
      .select()
      .from(suppliers)
      .where(eq(suppliers.tenantId, req.tenantContext!.tenantId));
    res.json(list);
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/tenants/:tenantId/suppliers/:supplierId
router.get("/:supplierId", authenticate, requireTenant(), async (req: Request, res: Response): Promise<void> => {
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
});

// POST /api/tenants/:tenantId/suppliers
router.post("/", authenticate, requireTenant("manager"), async (req: Request, res: Response): Promise<void> => {
  try {
    const body = supplierSchema.parse(req.body);
    const [supplier] = await db
      .insert(suppliers)
      .values({ ...body, tenantId: req.tenantContext!.tenantId })
      .returning();
    await createAuditLog({ tenantId: req.tenantContext!.tenantId, userId: req.user!.id, action: "create", resourceType: "supplier", resourceId: supplier.id });
    res.status(201).json(supplier);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: "Validation failed", details: error.issues });
      return;
    }
    res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /api/tenants/:tenantId/suppliers/:supplierId
router.patch("/:supplierId", authenticate, requireTenant("manager"), async (req: Request, res: Response): Promise<void> => {
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
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: "Validation failed", details: error.issues });
      return;
    }
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/tenants/:tenantId/suppliers/:supplierId
router.delete("/:supplierId", authenticate, requireTenant("manager"), async (req: Request, res: Response): Promise<void> => {
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
});

export default router;
