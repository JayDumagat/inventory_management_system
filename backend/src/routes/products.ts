import { Router, Request, Response } from "express";
import { z } from "zod";
import { db } from "../db";
import { products, productVariants, productAttributes, productAttributeOptions } from "../db/schema";
import { eq, and } from "drizzle-orm";
import { authenticate, requireTenant } from "../middleware/auth";
import { createAuditLog } from "../middleware/auditLog";

const router = Router({ mergeParams: true });

const productSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  categoryId: z.string().uuid().optional().nullable(),
  unitId: z.string().uuid().optional().nullable(),
  imageUrl: z.string().url().optional().nullable(),
  type: z.enum(["physical", "digital", "service", "bundle"]).optional().default("physical"),
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

// Attribute CRUD
// GET /api/tenants/:tenantId/products/:productId/attributes
router.get("/:productId/attributes", authenticate, requireTenant(), async (req: Request, res: Response): Promise<void> => {
  try {
    const [product] = await db
      .select()
      .from(products)
      .where(and(eq(products.id, req.params.productId as string), eq(products.tenantId, req.tenantContext!.tenantId)));
    if (!product) { res.status(404).json({ error: "Product not found" }); return; }

    const attrs = await db.query.productAttributes.findMany({
      where: eq(productAttributes.productId, req.params.productId as string),
      with: { options: true },
      orderBy: (a, { asc }) => [asc(a.sortOrder)],
    });
    res.json(attrs);
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/tenants/:tenantId/products/:productId/attributes
router.post("/:productId/attributes", authenticate, requireTenant("manager"), async (req: Request, res: Response): Promise<void> => {
  try {
    const [product] = await db
      .select()
      .from(products)
      .where(and(eq(products.id, req.params.productId as string), eq(products.tenantId, req.tenantContext!.tenantId)));
    if (!product) { res.status(404).json({ error: "Product not found" }); return; }

    const body = z.object({
      name: z.string().min(1),
      sortOrder: z.number().int().optional(),
      options: z.array(z.object({ value: z.string().min(1), sortOrder: z.number().int().optional() })).optional(),
    }).parse(req.body);

    const [attr] = await db
      .insert(productAttributes)
      .values({ productId: req.params.productId as string, name: body.name, sortOrder: body.sortOrder ?? 0 })
      .returning();

    if (body.options && body.options.length > 0) {
      await db.insert(productAttributeOptions).values(
        body.options.map((o, i) => ({ attributeId: attr.id, value: o.value, sortOrder: o.sortOrder ?? i }))
      );
    }

    const full = await db.query.productAttributes.findFirst({
      where: eq(productAttributes.id, attr.id),
      with: { options: true },
    });
    res.status(201).json(full);
  } catch (error) {
    if (error instanceof z.ZodError) { res.status(400).json({ error: "Validation failed", details: error.issues }); return; }
    res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /api/tenants/:tenantId/products/:productId/attributes/:attributeId
router.patch("/:productId/attributes/:attributeId", authenticate, requireTenant("manager"), async (req: Request, res: Response): Promise<void> => {
  try {
    const body = z.object({ name: z.string().min(1).optional(), sortOrder: z.number().int().optional() }).parse(req.body);
    const [attr] = await db
      .update(productAttributes)
      .set(body)
      .where(and(eq(productAttributes.id, req.params.attributeId as string), eq(productAttributes.productId, req.params.productId as string)))
      .returning();
    if (!attr) { res.status(404).json({ error: "Attribute not found" }); return; }
    res.json(attr);
  } catch (error) {
    if (error instanceof z.ZodError) { res.status(400).json({ error: "Validation failed", details: error.issues }); return; }
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/tenants/:tenantId/products/:productId/attributes/:attributeId
router.delete("/:productId/attributes/:attributeId", authenticate, requireTenant("manager"), async (req: Request, res: Response): Promise<void> => {
  try {
    const [attr] = await db
      .delete(productAttributes)
      .where(and(eq(productAttributes.id, req.params.attributeId as string), eq(productAttributes.productId, req.params.productId as string)))
      .returning();
    if (!attr) { res.status(404).json({ error: "Attribute not found" }); return; }
    res.json({ message: "Attribute deleted" });
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/tenants/:tenantId/products/:productId/attributes/:attributeId/options
router.post("/:productId/attributes/:attributeId/options", authenticate, requireTenant("manager"), async (req: Request, res: Response): Promise<void> => {
  try {
    const body = z.object({ value: z.string().min(1), sortOrder: z.number().int().optional() }).parse(req.body);
    const [attr] = await db
      .select()
      .from(productAttributes)
      .where(and(eq(productAttributes.id, req.params.attributeId as string), eq(productAttributes.productId, req.params.productId as string)));
    if (!attr) { res.status(404).json({ error: "Attribute not found" }); return; }

    const [option] = await db.insert(productAttributeOptions).values({ attributeId: attr.id, value: body.value, sortOrder: body.sortOrder ?? 0 }).returning();
    res.status(201).json(option);
  } catch (error) {
    if (error instanceof z.ZodError) { res.status(400).json({ error: "Validation failed", details: error.issues }); return; }
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/tenants/:tenantId/products/:productId/attributes/:attributeId/options/:optionId
router.delete("/:productId/attributes/:attributeId/options/:optionId", authenticate, requireTenant("manager"), async (req: Request, res: Response): Promise<void> => {
  try {
    const [option] = await db
      .delete(productAttributeOptions)
      .where(and(eq(productAttributeOptions.id, req.params.optionId as string), eq(productAttributeOptions.attributeId, req.params.attributeId as string)))
      .returning();
    if (!option) { res.status(404).json({ error: "Option not found" }); return; }
    res.json({ message: "Option deleted" });
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
