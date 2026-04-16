import { Request, Response } from "express";
import { db } from "../db";
import { transactions, branches } from "../db/schema";
import { eq, and, desc } from "drizzle-orm";
import { createAuditLog } from "../services/audit";
import { handleControllerError } from "../utils/errors";
import { transactionSchema } from "../validators/transaction";

export const listTransactions = async (req: Request, res: Response): Promise<void> => {
  try {
    const branchId = typeof req.query.branchId === "string" ? req.query.branchId : undefined;
    const whereCondition = branchId
      ? and(eq(transactions.tenantId, req.tenantContext!.tenantId), eq(transactions.branchId, branchId))
      : eq(transactions.tenantId, req.tenantContext!.tenantId);
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
      .where(whereCondition)
      .orderBy(desc(transactions.createdAt));
    res.json(list);
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
};

export const createTransaction = async (req: Request, res: Response): Promise<void> => {
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
    handleControllerError(error, res);
  }
};

export const deleteTransaction = async (req: Request, res: Response): Promise<void> => {
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
};
