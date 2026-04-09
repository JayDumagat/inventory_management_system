import { Router, Request, Response } from "express";
import { z } from "zod";
import { db } from "../db";
import { products, productVariants } from "../db/schema";
import { eq, and } from "drizzle-orm";
import { authenticate, requireTenant } from "../middleware/auth";
import { createAuditLog } from "../middleware/auditLog";

const router = Router({ mergeParams: true });

const productSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  categoryId: z.string().uuid().optional().nullable(),
  imageUrl: z.string().url().optional().nullable(),
});

const variantSchema = z.object({
  name: z.string().min(1),
  sku: z.string().min(1),
  barcode: z.string().optional().nullable(),
  price: z.string().or(z.number()),
  costPrice: z.string().or(z.number()).optional(),
  attributes: z.record(z.string(), z.unknown()).optional(),
  imageUrl: z.string().url().optional().nullable(),
});

router.get("/", authenticate, requireTenant(), async (req: Request, res: Response): Promise<void> => {
  try {
    const list = await db.query.products.findMany({
      where: eq(products.tenantId, req.tenantContext!.tenantId),
      with: { variants: true, category: true },
    });
    res.json(list);
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/", authenticate, requireTenant("manager"), async (req: Request, res: Response): Promise<void> => {
  try {
    const body = productSchema.parse(req.body);
    const [product] = await db.insert(products).values({ ...body, tenantId: req.tenantContext!.tenantId }).returning();
    await createAuditLog({ tenantId: req.tenantContext!.tenantId, userId: req.user!.id, action: "create", resourceType: "product", resourceId: product.id });
    res.status(201).json(product);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: "Validation failed", details: error.issues });
      return;
    }
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/:productId", authenticate, requireTenant(), async (req: Request, res: Response): Promise<void> => {
  try {
    const product = await db.query.products.findFirst({
      where: and(eq(products.id, req.params.productId as string), eq(products.tenantId, req.tenantContext!.tenantId)),
      with: { variants: { with: { inventory: { with: { branch: true } } } }, category: true },
    });
    if (!product) {
      res.status(404).json({ error: "Product not found" });
      return;
    }
    res.json(product);
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/:productId", authenticate, requireTenant("manager"), async (req: Request, res: Response): Promise<void> => {
  try {
    const body = productSchema.partial().parse(req.body);
    const [product] = await db.update(products).set({ ...body, updatedAt: new Date() }).where(and(eq(products.id, req.params.productId as string), eq(products.tenantId, req.tenantContext!.tenantId))).returning();
    if (!product) {
      res.status(404).json({ error: "Product not found" });
      return;
    }
    res.json(product);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: "Validation failed", details: error.issues });
      return;
    }
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/:productId", authenticate, requireTenant("manager"), async (req: Request, res: Response): Promise<void> => {
  try {
    const [product] = await db.delete(products).where(and(eq(products.id, req.params.productId as string), eq(products.tenantId, req.tenantContext!.tenantId))).returning();
    if (!product) {
      res.status(404).json({ error: "Product not found" });
      return;
    }
    await createAuditLog({ tenantId: req.tenantContext!.tenantId, userId: req.user!.id, action: "delete", resourceType: "product", resourceId: product.id });
    res.json({ message: "Product deleted" });
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

// Variants CRUD
router.get("/:productId/variants", authenticate, requireTenant(), async (req: Request, res: Response): Promise<void> => {
  try {
    const [product] = await db.select().from(products).where(and(eq(products.id, req.params.productId as string), eq(products.tenantId, req.tenantContext!.tenantId)));
    if (!product) {
      res.status(404).json({ error: "Product not found" });
      return;
    }
    const variants = await db.select().from(productVariants).where(eq(productVariants.productId, req.params.productId as string));
    res.json(variants);
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/:productId/variants", authenticate, requireTenant("manager"), async (req: Request, res: Response): Promise<void> => {
  try {
    const [product] = await db.select().from(products).where(and(eq(products.id, req.params.productId as string), eq(products.tenantId, req.tenantContext!.tenantId)));
    if (!product) {
      res.status(404).json({ error: "Product not found" });
      return;
    }
    const body = variantSchema.parse(req.body);
    const [variant] = await db.insert(productVariants).values({ ...body, productId: req.params.productId as string, price: String(body.price), costPrice: String(body.costPrice || "0") }).returning();
    res.status(201).json(variant);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: "Validation failed", details: error.issues });
      return;
    }
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/:productId/variants/:variantId", authenticate, requireTenant("manager"), async (req: Request, res: Response): Promise<void> => {
  try {
    const [product] = await db.select().from(products).where(and(eq(products.id, req.params.productId as string), eq(products.tenantId, req.tenantContext!.tenantId)));
    if (!product) {
      res.status(404).json({ error: "Product not found" });
      return;
    }
    const body = variantSchema.partial().parse(req.body);
    const updateData: {
      name?: string;
      sku?: string;
      barcode?: string | null;
      price?: string;
      costPrice?: string;
      attributes?: Record<string, unknown>;
      imageUrl?: string | null;
      updatedAt: Date;
    } = { updatedAt: new Date() };
    if (body.name !== undefined) updateData.name = body.name;
    if (body.sku !== undefined) updateData.sku = body.sku;
    if (body.barcode !== undefined) updateData.barcode = body.barcode ?? null;
    if (body.price !== undefined) updateData.price = String(body.price);
    if (body.costPrice !== undefined) updateData.costPrice = String(body.costPrice);
    if (body.attributes !== undefined) updateData.attributes = body.attributes;
    if (body.imageUrl !== undefined) updateData.imageUrl = body.imageUrl ?? null;
    const [variant] = await db.update(productVariants).set(updateData).where(and(eq(productVariants.id, req.params.variantId as string), eq(productVariants.productId, req.params.productId as string))).returning();
    if (!variant) {
      res.status(404).json({ error: "Variant not found" });
      return;
    }
    res.json(variant);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: "Validation failed", details: error.issues });
      return;
    }
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/:productId/variants/:variantId", authenticate, requireTenant("manager"), async (req: Request, res: Response): Promise<void> => {
  try {
    const [product] = await db.select().from(products).where(and(eq(products.id, req.params.productId as string), eq(products.tenantId, req.tenantContext!.tenantId)));
    if (!product) {
      res.status(404).json({ error: "Product not found" });
      return;
    }
    const [variant] = await db.delete(productVariants).where(and(eq(productVariants.id, req.params.variantId as string), eq(productVariants.productId, req.params.productId as string))).returning();
    if (!variant) {
      res.status(404).json({ error: "Variant not found" });
      return;
    }
    res.json({ message: "Variant deleted" });
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
