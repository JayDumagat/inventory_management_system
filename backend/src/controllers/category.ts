import { Request, Response } from "express";
import { db } from "../db";
import { categories, products } from "../db/schema";
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
    const tenantId = req.tenantContext!.tenantId;

    // Validate parentId exists if provided
    if (body.parentId) {
      const [parent] = await db.select().from(categories).where(and(eq(categories.id, body.parentId), eq(categories.tenantId, tenantId)));
      if (!parent) {
        res.status(400).json({ error: "Parent category not found" });
        return;
      }
    }

    const [cat] = await db.insert(categories).values({ ...body, tenantId }).returning();
    await createAuditLog({ tenantId, userId: req.user!.id, action: "create", resourceType: "category", resourceId: cat.id });
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
    const tenantId = req.tenantContext!.tenantId;
    const categoryId = req.params.categoryId as string;

    // Prevent self-referencing parent
    if (body.parentId && body.parentId === categoryId) {
      res.status(400).json({ error: "A category cannot be its own parent" });
      return;
    }

    // Validate parentId exists if provided
    if (body.parentId) {
      const [parent] = await db.select().from(categories).where(and(eq(categories.id, body.parentId), eq(categories.tenantId, tenantId)));
      if (!parent) {
        res.status(400).json({ error: "Parent category not found" });
        return;
      }
    }

    const [cat] = await db.update(categories).set({ ...body, updatedAt: new Date() }).where(and(eq(categories.id, categoryId), eq(categories.tenantId, tenantId))).returning();
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
    const tenantId = req.tenantContext!.tenantId;
    const categoryId = req.params.categoryId as string;

    // Check if category has products
    const productsInCategory = await db.select().from(products).where(eq(products.categoryId, categoryId)).limit(1);
    if (productsInCategory.length > 0) {
      res.status(400).json({ error: "Cannot delete category that has products assigned. Remove or reassign products first." });
      return;
    }

    // Check if category has child categories
    const childCategories = await db.select().from(categories).where(and(eq(categories.parentId, categoryId), eq(categories.tenantId, tenantId))).limit(1);
    if (childCategories.length > 0) {
      res.status(400).json({ error: "Cannot delete category that has subcategories. Delete subcategories first." });
      return;
    }

    const [cat] = await db.delete(categories).where(and(eq(categories.id, categoryId), eq(categories.tenantId, tenantId))).returning();
    if (!cat) {
      res.status(404).json({ error: "Category not found" });
      return;
    }
    await createAuditLog({ tenantId, userId: req.user!.id, action: "delete", resourceType: "category", resourceId: cat.id });
    res.json({ message: "Category deleted" });
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
}
