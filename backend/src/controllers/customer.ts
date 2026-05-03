import { Request, Response } from "express";
import { db } from "../db";
import { customers } from "../db/schema";
import { eq, and, or, ilike } from "drizzle-orm";
import { createAuditLog } from "../services/audit";
import { handleControllerError } from "../utils/errors";
import { customerSchema, customerSearchSchema } from "../validators/customer";

export async function listCustomers(req: Request, res: Response): Promise<void> {
  try {
    const list = await db.select().from(customers)
      .where(eq(customers.tenantId, req.tenantContext!.tenantId))
      .orderBy(customers.name);
    res.json(list);
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function searchCustomers(req: Request, res: Response): Promise<void> {
  try {
    const { q } = customerSearchSchema.parse(req.query);
    const tenantId = req.tenantContext!.tenantId;

    if (!q || q.trim().length === 0) {
      const list = await db.select().from(customers)
        .where(eq(customers.tenantId, tenantId))
        .orderBy(customers.name)
        .limit(20);
      res.json(list);
      return;
    }

    const pattern = `%${q.trim()}%`;
    const list = await db.select().from(customers)
      .where(and(
        eq(customers.tenantId, tenantId),
        or(
          ilike(customers.name, pattern),
          ilike(customers.email, pattern),
          ilike(customers.phone, pattern)
        )
      ))
      .orderBy(customers.name)
      .limit(20);
    res.json(list);
  } catch (error) {
    handleControllerError(error, res);
  }
}

export async function getCustomer(req: Request, res: Response): Promise<void> {
  try {
    const [customer] = await db.select().from(customers)
      .where(and(
        eq(customers.id, req.params.customerId as string),
        eq(customers.tenantId, req.tenantContext!.tenantId)
      ));
    if (!customer) {
      res.status(404).json({ error: "Customer not found" });
      return;
    }
    res.json(customer);
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function createCustomer(req: Request, res: Response): Promise<void> {
  try {
    const body = customerSchema.parse(req.body);
    const tenantId = req.tenantContext!.tenantId;
    const [customer] = await db.insert(customers).values({
      ...body,
      tenantId,
      dataConsentGiven: body.dataConsentGiven ?? false,
      dataConsentDate: body.dataConsentGiven ? new Date() : null,
    }).returning();
    await createAuditLog({
      tenantId,
      userId: req.user!.id,
      action: "create",
      resourceType: "customer",
      resourceId: customer.id,
    });
    res.status(201).json(customer);
  } catch (error) {
    handleControllerError(error, res);
  }
}

export async function updateCustomer(req: Request, res: Response): Promise<void> {
  try {
    const body = customerSchema.partial().parse(req.body);
    const tenantId = req.tenantContext!.tenantId;
    const updateData: Record<string, unknown> = { ...body, updatedAt: new Date() };
    if (body.dataConsentGiven === true) {
      updateData.dataConsentDate = new Date();
    }
    const [customer] = await db.update(customers)
      .set(updateData)
      .where(and(
        eq(customers.id, req.params.customerId as string),
        eq(customers.tenantId, tenantId)
      ))
      .returning();
    if (!customer) {
      res.status(404).json({ error: "Customer not found" });
      return;
    }
    await createAuditLog({
      tenantId,
      userId: req.user!.id,
      action: "update",
      resourceType: "customer",
      resourceId: customer.id,
    });
    res.json(customer);
  } catch (error) {
    handleControllerError(error, res);
  }
}

export async function deleteCustomer(req: Request, res: Response): Promise<void> {
  try {
    const tenantId = req.tenantContext!.tenantId;
    const [customer] = await db.delete(customers)
      .where(and(
        eq(customers.id, req.params.customerId as string),
        eq(customers.tenantId, tenantId)
      ))
      .returning();
    if (!customer) {
      res.status(404).json({ error: "Customer not found" });
      return;
    }
    await createAuditLog({
      tenantId,
      userId: req.user!.id,
      action: "delete",
      resourceType: "customer",
      resourceId: customer.id,
    });
    res.json({ message: "Customer deleted" });
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
}
