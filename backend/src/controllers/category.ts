import { Request, Response } from "express";
import { db } from "../db";
import { categories } from "../db/schema";
import { eq, and } from "drizzle-orm";
import { createAuditLog } from "../services/audit";
import { handleControllerError } from "../utils/errors";
import { categorySchema } from "../validators/category";

export async function listCategories(req: Request, res: Response): Promise<void> {
  try {
    const list = await db.select().from(categories).where(eq(categories.tenantId, req.tenantContext!.tenantId));
    res.json(list);
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function createCategory(req: Request, res: Response): Promise<void> {
  try {
    const body = categorySchema.parse(req.body);
    const [cat] = await db.insert(categories).values({ ...body, tenantId: req.tenantContext!.tenantId }).returning();
    await createAuditLog({ tenantId: req.tenantContext!.tenantId, userId: req.user!.id, action: "create", resourceType: "category", resourceId: cat.id });
    res.status(201).json(cat);
  } catch (error) {
    handleControllerError(error, res);
  }
}

export async function getCategory(req: Request, res: Response): Promise<void> {
  try {
    const [cat] = await db.select().from(categories).where(and(eq(categories.id, req.params.categoryId as string), eq(categories.tenantId, req.tenantContext!.tenantId)));
    if (!cat) {
      res.status(404).json({ error: "Category not found" });
      return;
    }
    res.json(cat);
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function updateCategory(req: Request, res: Response): Promise<void> {
  try {
    const body = categorySchema.partial().parse(req.body);
    const [cat] = await db.update(categories).set({ ...body, updatedAt: new Date() }).where(and(eq(categories.id, req.params.categoryId as string), eq(categories.tenantId, req.tenantContext!.tenantId))).returning();
    if (!cat) {
      res.status(404).json({ error: "Category not found" });
      return;
    }
    res.json(cat);
  } catch (error) {
    handleControllerError(error, res);
  }
}

export async function deleteCategory(req: Request, res: Response): Promise<void> {
  try {
    const [cat] = await db.delete(categories).where(and(eq(categories.id, req.params.categoryId as string), eq(categories.tenantId, req.tenantContext!.tenantId))).returning();
    if (!cat) {
      res.status(404).json({ error: "Category not found" });
      return;
    }
    await createAuditLog({ tenantId: req.tenantContext!.tenantId, userId: req.user!.id, action: "delete", resourceType: "category", resourceId: cat.id });
    res.json({ message: "Category deleted" });
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
}
