import { Request, Response } from "express";
import { db } from "../db";
import { products, productVariants, productAttributes, productAttributeOptions, productImages } from "../db/schema";
import { eq, and } from "drizzle-orm";
import { createAuditLog } from "../services/audit";
import { handleControllerError } from "../utils/errors";
import { productSchema, variantSchema, attributeSchema, updateAttributeSchema, attributeOptionSchema } from "../validators/product";

export async function listProducts(req: Request, res: Response): Promise<void> {
  try {
    const list = await db.query.products.findMany({
      where: eq(products.tenantId, req.tenantContext!.tenantId),
      with: { variants: true, category: true, images: true },
    });
    res.json(list);
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function createProduct(req: Request, res: Response): Promise<void> {
  try {
    const body = productSchema.parse(req.body);
    const [product] = await db.insert(products).values({ ...body, tenantId: req.tenantContext!.tenantId }).returning();
    await createAuditLog({ tenantId: req.tenantContext!.tenantId, userId: req.user!.id, action: "create", resourceType: "product", resourceId: product.id });
    res.status(201).json(product);
  } catch (error) {
    handleControllerError(error, res);
  }
}

export async function getProduct(req: Request, res: Response): Promise<void> {
  try {
    const product = await db.query.products.findFirst({
      where: and(eq(products.id, req.params.productId as string), eq(products.tenantId, req.tenantContext!.tenantId)),
      with: { variants: { with: { inventory: { with: { branch: true } } } }, category: true, images: true },
    });
    if (!product) {
      res.status(404).json({ error: "Product not found" });
      return;
    }
    res.json(product);
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function updateProduct(req: Request, res: Response): Promise<void> {
  try {
    const body = productSchema.partial().parse(req.body);
    const [product] = await db.update(products).set({ ...body, updatedAt: new Date() }).where(and(eq(products.id, req.params.productId as string), eq(products.tenantId, req.tenantContext!.tenantId))).returning();
    if (!product) {
      res.status(404).json({ error: "Product not found" });
      return;
    }
    res.json(product);
  } catch (error) {
    handleControllerError(error, res);
  }
}

export async function deleteProduct(req: Request, res: Response): Promise<void> {
  try {
    const tenantId = req.tenantContext!.tenantId;
    const productId = req.params.productId as string;

    // Check if product exists
    const existing = await db.query.products.findFirst({
      where: and(eq(products.id, productId), eq(products.tenantId, tenantId)),
      with: { variants: true },
    });
    if (!existing) {
      res.status(404).json({ error: "Product not found" });
      return;
    }

    // Check if any variant is referenced in active orders
    if (existing.variants.length > 0) {
      const { salesOrderItems, salesOrders } = await import("../db/schema");
      const variantIds = existing.variants.map((v) => v.id);
      for (const vid of variantIds) {
        const orderItems = await db.select({ orderId: salesOrderItems.orderId })
          .from(salesOrderItems)
          .where(eq(salesOrderItems.variantId, vid))
          .limit(1);
        if (orderItems.length > 0) {
          const [order] = await db.select().from(salesOrders).where(eq(salesOrders.id, orderItems[0].orderId));
          if (order && !["cancelled", "refunded"].includes(order.status)) {
            res.status(400).json({ error: "Cannot delete product with active orders. Cancel or complete all orders first." });
            return;
          }
        }
      }
    }

    const [product] = await db.delete(products).where(and(eq(products.id, productId), eq(products.tenantId, tenantId))).returning();
    if (!product) {
      res.status(404).json({ error: "Product not found" });
      return;
    }
    await createAuditLog({ tenantId, userId: req.user!.id, action: "delete", resourceType: "product", resourceId: product.id });
    res.json({ message: "Product deleted" });
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function listVariants(req: Request, res: Response): Promise<void> {
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
}

export async function createVariant(req: Request, res: Response): Promise<void> {
  try {
    const [product] = await db.select().from(products).where(and(eq(products.id, req.params.productId as string), eq(products.tenantId, req.tenantContext!.tenantId)));
    if (!product) {
      res.status(404).json({ error: "Product not found" });
      return;
    }
    const body = variantSchema.parse(req.body);
    const [variant] = await db.insert(productVariants).values({
      ...body,
      productId: req.params.productId as string,
      price: String(body.price),
      costPrice: String(body.costPrice || "0"),
    }).returning();
    res.status(201).json(variant);
  } catch (error) {
    handleControllerError(error, res);
  }
}

export async function updateVariant(req: Request, res: Response): Promise<void> {
  try {
    const [product] = await db.select().from(products).where(and(eq(products.id, req.params.productId as string), eq(products.tenantId, req.tenantContext!.tenantId)));
    if (!product) {
      res.status(404).json({ error: "Product not found" });
      return;
    }
    const body = variantSchema.partial().parse(req.body);
    const updateData: {
      name?: string; sku?: string; barcode?: string | null; price?: string;
      costPrice?: string; attributes?: Record<string, unknown>; imageUrl?: string | null; updatedAt: Date;
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
    handleControllerError(error, res);
  }
}

export async function deleteVariant(req: Request, res: Response): Promise<void> {
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
}

export async function listAttributes(req: Request, res: Response): Promise<void> {
  try {
    const [product] = await db.select().from(products).where(and(eq(products.id, req.params.productId as string), eq(products.tenantId, req.tenantContext!.tenantId)));
    if (!product) {
      res.status(404).json({ error: "Product not found" });
      return;
    }
    const attrs = await db.query.productAttributes.findMany({
      where: eq(productAttributes.productId, req.params.productId as string),
      with: { options: true },
      orderBy: (a, { asc }) => [asc(a.sortOrder)],
    });
    res.json(attrs);
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function createAttribute(req: Request, res: Response): Promise<void> {
  try {
    const [product] = await db.select().from(products).where(and(eq(products.id, req.params.productId as string), eq(products.tenantId, req.tenantContext!.tenantId)));
    if (!product) {
      res.status(404).json({ error: "Product not found" });
      return;
    }
    const body = attributeSchema.parse(req.body);
    const [attr] = await db.insert(productAttributes).values({
      productId: req.params.productId as string,
      name: body.name,
      sortOrder: body.sortOrder ?? 0,
    }).returning();
    if (body.options && body.options.length > 0) {
      await db.insert(productAttributeOptions).values(
        body.options.map((opt) => ({
          attributeId: attr.id,
          value: opt.value,
          sortOrder: opt.sortOrder ?? 0,
        })),
      );
    }
    const full = await db.query.productAttributes.findFirst({
      where: eq(productAttributes.id, attr.id),
      with: { options: true },
    });
    res.status(201).json(full);
  } catch (error) {
    handleControllerError(error, res);
  }
}

export async function updateAttribute(req: Request, res: Response): Promise<void> {
  try {
    const body = updateAttributeSchema.parse(req.body);
    const [attr] = await db.update(productAttributes).set(body).where(and(eq(productAttributes.id, req.params.attributeId as string), eq(productAttributes.productId, req.params.productId as string))).returning();
    if (!attr) {
      res.status(404).json({ error: "Attribute not found" });
      return;
    }
    res.json(attr);
  } catch (error) {
    handleControllerError(error, res);
  }
}

export async function deleteAttribute(req: Request, res: Response): Promise<void> {
  try {
    const [attr] = await db.delete(productAttributes).where(and(eq(productAttributes.id, req.params.attributeId as string), eq(productAttributes.productId, req.params.productId as string))).returning();
    if (!attr) {
      res.status(404).json({ error: "Attribute not found" });
      return;
    }
    res.json({ message: "Attribute deleted" });
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function createAttributeOption(req: Request, res: Response): Promise<void> {
  try {
    const body = attributeOptionSchema.parse(req.body);
    const [attr] = await db.select().from(productAttributes).where(and(eq(productAttributes.id, req.params.attributeId as string), eq(productAttributes.productId, req.params.productId as string)));
    if (!attr) {
      res.status(404).json({ error: "Attribute not found" });
      return;
    }
    const [option] = await db.insert(productAttributeOptions).values({
      attributeId: req.params.attributeId as string,
      value: body.value,
      sortOrder: body.sortOrder ?? 0,
    }).returning();
    res.status(201).json(option);
  } catch (error) {
    handleControllerError(error, res);
  }
}

export async function deleteAttributeOption(req: Request, res: Response): Promise<void> {
  try {
    const [option] = await db.delete(productAttributeOptions).where(and(eq(productAttributeOptions.id, req.params.optionId as string), eq(productAttributeOptions.attributeId, req.params.attributeId as string))).returning();
    if (!option) {
      res.status(404).json({ error: "Option not found" });
      return;
    }
    res.json({ message: "Option deleted" });
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function listProductImages(req: Request, res: Response): Promise<void> {
  try {
    const [product] = await db.select().from(products).where(and(eq(products.id, req.params.productId as string), eq(products.tenantId, req.tenantContext!.tenantId)));
    if (!product) {
      res.status(404).json({ error: "Product not found" });
      return;
    }
    const images = await db.select().from(productImages)
      .where(eq(productImages.productId, req.params.productId as string))
      .orderBy(productImages.sortOrder);
    res.json(images);
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function addProductImage(req: Request, res: Response): Promise<void> {
  try {
    const [product] = await db.select().from(products).where(and(eq(products.id, req.params.productId as string), eq(products.tenantId, req.tenantContext!.tenantId)));
    if (!product) {
      res.status(404).json({ error: "Product not found" });
      return;
    }
    const { objectName, url, altText, sortOrder } = req.body as {
      objectName?: string; url?: string; altText?: string; sortOrder?: number;
    };
    if (!objectName || !url) {
      res.status(400).json({ error: "objectName and url are required" });
      return;
    }
    const [image] = await db.insert(productImages).values({
      productId: req.params.productId as string,
      objectName,
      url,
      altText: altText || null,
      sortOrder: sortOrder ?? 0,
    }).returning();
    res.status(201).json(image);
  } catch (error) {
    handleControllerError(error, res);
  }
}

export async function deleteProductImage(req: Request, res: Response): Promise<void> {
  try {
    const [product] = await db.select().from(products).where(and(eq(products.id, req.params.productId as string), eq(products.tenantId, req.tenantContext!.tenantId)));
    if (!product) {
      res.status(404).json({ error: "Product not found" });
      return;
    }
    const [image] = await db.delete(productImages)
      .where(and(
        eq(productImages.id, req.params.imageId as string),
        eq(productImages.productId, req.params.productId as string)
      ))
      .returning();
    if (!image) {
      res.status(404).json({ error: "Image not found" });
      return;
    }
    // Attempt to delete from MinIO storage (best effort)
    try {
      const { deleteFile } = await import("../lib/storage");
      await deleteFile(image.objectName);
    } catch {
      // Storage deletion is best-effort; log but don't fail the request
      console.error(`Failed to delete file from storage: ${image.objectName}`);
    }
    res.json({ message: "Image deleted" });
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
}
