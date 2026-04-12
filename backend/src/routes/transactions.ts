import { Router, Request, Response } from "express";
import { z } from "zod";
import { db } from "../db";
import { transactions, branches } from "../db/schema";
import { eq, and, desc } from "drizzle-orm";
import { authenticate, requireTenant } from "../middleware/auth";
import { createAuditLog } from "../middleware/auditLog";

const router = Router({ mergeParams: true });

const transactionSchema = z.object({
  type: z.enum(["sale", "purchase", "expense", "refund", "adjustment", "other"]),
  amount: z.number(),
  description: z.string().min(1),
  branchId: z.string().uuid().optional(),
  referenceType: z.string().optional(),
  referenceId: z.string().optional(),
  notes: z.string().optional(),
});

// GET /api/tenants/:tenantId/transactions
router.get("/", authenticate, requireTenant(), async (req: Request, res: Response): Promise<void> => {
  try {
    const list = await db
      .select({
        id: transactions.id,
        type: transactions.type,
        amount: transactions.amount,
        description: transactions.description,
        referenceType: transactions.referenceType,
        referenceId: transactions.referenceId,
        notes: transactions.notes,
        createdAt: transactions.createdAt,
        branchId: transactions.branchId,
        branchName: branches.name,
      })
      .from(transactions)
      .leftJoin(branches, eq(transactions.branchId, branches.id))
      .where(eq(transactions.tenantId, req.tenantContext!.tenantId))
      .orderBy(desc(transactions.createdAt));
    res.json(list);
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/tenants/:tenantId/transactions
router.post("/", authenticate, requireTenant("manager"), async (req: Request, res: Response): Promise<void> => {
  try {
    const body = transactionSchema.parse(req.body);
    const [transaction] = await db
      .insert(transactions)
      .values({
        tenantId: req.tenantContext!.tenantId,
        branchId: body.branchId ?? null,
        type: body.type,
        amount: body.amount.toFixed(2),
        description: body.description,
        referenceType: body.referenceType,
        referenceId: body.referenceId,
        notes: body.notes,
        createdBy: req.user!.id,
      })
      .returning();
    await createAuditLog({ tenantId: req.tenantContext!.tenantId, userId: req.user!.id, action: "create", resourceType: "transaction", resourceId: transaction.id });
    res.status(201).json(transaction);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: "Validation failed", details: error.issues });
      return;
    }
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/tenants/:tenantId/transactions/:transactionId
router.delete("/:transactionId", authenticate, requireTenant("admin"), async (req: Request, res: Response): Promise<void> => {
  try {
    const [transaction] = await db
      .delete(transactions)
      .where(and(eq(transactions.id, req.params.transactionId as string), eq(transactions.tenantId, req.tenantContext!.tenantId)))
      .returning();
    if (!transaction) {
      res.status(404).json({ error: "Transaction not found" });
      return;
    }
    await createAuditLog({ tenantId: req.tenantContext!.tenantId, userId: req.user!.id, action: "delete", resourceType: "transaction", resourceId: transaction.id });
    res.json({ message: "Transaction deleted" });
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
