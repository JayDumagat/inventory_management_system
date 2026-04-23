import { Request, Response } from "express";
import { db } from "../db";
import { products, productVariants, productAttributes, productAttributeOptions, productImages } from "../db/schema";
import { eq, and } from "drizzle-orm";
import { createAuditLog } from "../services/audit";
import { handleControllerError } from "../utils/errors";
import { productSchema, variantSchema, attributeSchema, updateAttributeSchema, attributeOptionSchema } from "../validators/product";
import { getPublicUrl, getPresignedUrl } from "../lib/storage";
import { isTenantOwnedObjectName } from "../lib/storageObjectName";
import { cacheGet, cacheSet, cacheDel } from "../lib/redis";
import { presignCacheKey } from "./upload";

function normalizeSkuPart(value: string, max = 8): string {
  return value
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "")
    .slice(0, max);
}

function generateVariantSku(productName: string, optionValues: string[], sequence: number): string {
  const base = normalizeSkuPart(productName, 12) || "PRD";
  const optionCodes = optionValues.map((v) => normalizeSkuPart(v, 6)).filter(Boolean);
  return `${base}${optionCodes.length ? `-${optionCodes.join("-")}` : ""}-${String(sequence).padStart(3, "0")}`;
}

type AttributeWithOptions = {
  id: string;
  name: string;
  options: { id: string; value: string; sortOrder: number }[];
};

type AttributeValueMap = Record<string, string>;

function serializeAttributeMap(map: AttributeValueMap): string {
  return JSON.stringify(
    Object.keys(map)
      .sort()
      .reduce<AttributeValueMap>((acc, key) => {
        acc[key] = map[key];
        return acc;
      }, {})
  );
}

function buildAttributeCombinations(attributes: AttributeWithOptions[]): Array<{ values: string[]; map: AttributeValueMap }> {
  if (attributes.length === 0) return [];
  const result: Array<{ values: string[]; map: AttributeValueMap }> = [];

  const walk = (index: number, values: string[], map: AttributeValueMap) => {
    if (index === attributes.length) {
      result.push({ values: [...values], map: { ...map } });
      return;
    }
    const attribute = attributes[index];
    const sortedOptions = [...attribute.options].sort((a, b) => a.sortOrder - b.sortOrder);
    for (const option of sortedOptions) {
      walk(index + 1, [...values, option.value], { ...map, [attribute.name]: option.value });
    }
  };

  walk(0, [], {});
  return result;
}

async function toPresignedImageUrl<T extends { objectName: string }>(image: T): Promise<T & { url: string }> {
  const presigned = await getPresignedUrl(image.objectName);
  return { ...image, url: presigned || getPublicUrl(image.objectName) };
}

export async function listProducts(req: Request, res: Response): Promise<void> {
  try {
    const list = await db.query.products.findMany({
      where: eq(products.tenantId, req.tenantContext!.tenantId),
      with: { variants: true, category: true, images: true },
    });
    const result = await Promise.all(list.map(async (product) => ({
      ...product,
      images: product.images ? await Promise.all(product.images.map(toPresignedImageUrl)) : [],
    })));
    res.json(result);
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function createProduct(req: Request, res: Response): Promise<void> {
  try {
    const body = productSchema.parse(req.body);
    const trackStock = body.trackStock ?? true;
    const [product] = await db.insert(products).values({ ...body, trackStock, tenantId: req.tenantContext!.tenantId }).returning();
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
    const mappedImages = product.images ? await Promise.all(product.images.map(toPresignedImageUrl)) : [];
    res.json({
      ...product,
      images: mappedImages,
    });
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

export async function generateVariantsFromAttributes(req: Request, res: Response): Promise<void> {
  try {
    const tenantId = req.tenantContext!.tenantId;
    const productId = req.params.productId as string;

    const [product] = await db.select().from(products).where(and(eq(products.id, productId), eq(products.tenantId, tenantId)));
    if (!product) {
      res.status(404).json({ error: "Product not found" });
      return;
    }

    const attrs = await db.query.productAttributes.findMany({
      where: eq(productAttributes.productId, productId),
      with: { options: true },
      orderBy: (a, { asc }) => [asc(a.sortOrder)],
    });

    const usableAttrs = attrs
      .map((a) => ({ ...a, options: a.options ?? [] }))
      .filter((a) => a.options.length > 0);

    if (usableAttrs.length === 0) {
      res.status(400).json({ error: "Add at least one attribute with options before generating variants" });
      return;
    }

    const combinations = buildAttributeCombinations(usableAttrs);
    const existing = await db.select().from(productVariants).where(eq(productVariants.productId, productId));
    const existingKeys = new Set(existing.map((v) => serializeAttributeMap((v.attributes ?? {}) as AttributeValueMap)));

    const toCreate = combinations.filter((combo) => !existingKeys.has(serializeAttributeMap(combo.map)));
    if (toCreate.length === 0) {
      res.json({ created: 0, variants: [] });
      return;
    }

    const created = await db.insert(productVariants).values(
      toCreate.map((combo, index) => ({
        productId,
        name: combo.values.join(" / "),
        sku: generateVariantSku(product.name, combo.values, existing.length + index + 1),
        price: "0",
        costPrice: "0",
        attributes: combo.map,
      }))
    ).returning();

    res.status(201).json({ created: created.length, variants: created });
  } catch (error) {
    handleControllerError(error, res);
  }
}

const PRODUCT_IMAGES_CACHE_TTL = 120; // 2 minutes

function productImagesCacheKey(tenantId: string, productId: string): string {
  return `product_images:${tenantId}:${productId}`;
}

export async function listProductImages(req: Request, res: Response): Promise<void> {
  try {
    const tenantId = req.tenantContext!.tenantId;
    const productId = req.params.productId as string;

    const [product] = await db.select().from(products).where(and(eq(products.id, productId), eq(products.tenantId, tenantId)));
    if (!product) {
      res.status(404).json({ error: "Product not found" });
      return;
    }

    const cacheKey = productImagesCacheKey(tenantId, productId);
    const cached = await cacheGet<Awaited<ReturnType<typeof toPresignedImageUrl>>[]>(cacheKey);
    if (cached) {
      res.json(cached);
      return;
    }

    const images = await db.select().from(productImages)
      .where(eq(productImages.productId, productId))
      .orderBy(productImages.sortOrder);
    const result = await Promise.all(images.map(toPresignedImageUrl));
    await cacheSet(cacheKey, result, PRODUCT_IMAGES_CACHE_TTL);
    res.json(result);
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function addProductImage(req: Request, res: Response): Promise<void> {
  try {
    const tenantId = req.tenantContext!.tenantId;
    const productId = req.params.productId as string;

    const [product] = await db.select().from(products).where(and(eq(products.id, productId), eq(products.tenantId, tenantId)));
    if (!product) {
      res.status(404).json({ error: "Product not found" });
      return;
    }
    const { objectName, altText, sortOrder } = req.body as {
      objectName?: string; altText?: string; sortOrder?: number;
    };
    if (!objectName) {
      res.status(400).json({ error: "objectName is required" });
      return;
    }
    if (!isTenantOwnedObjectName(objectName, tenantId)) {
      res.status(403).json({ error: "Access denied" });
      return;
    }
    const derivedUrl = getPublicUrl(objectName);
    const [image] = await db.insert(productImages).values({
      productId,
      objectName,
      url: derivedUrl,
      altText: altText || null,
      sortOrder: sortOrder ?? 0,
    }).returning();
    // Invalidate cached image list so the new image is included on next fetch.
    await cacheDel(productImagesCacheKey(tenantId, productId));
    res.status(201).json(image);
  } catch (error) {
    handleControllerError(error, res);
  }
}

export async function deleteProductImage(req: Request, res: Response): Promise<void> {
  try {
    const tenantId = req.tenantContext!.tenantId;
    const productId = req.params.productId as string;

    const [product] = await db.select().from(products).where(and(eq(products.id, productId), eq(products.tenantId, tenantId)));
    if (!product) {
      res.status(404).json({ error: "Product not found" });
      return;
    }
    const [image] = await db.delete(productImages)
      .where(and(
        eq(productImages.id, req.params.imageId as string),
        eq(productImages.productId, productId)
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
    // Invalidate the presigned URL cache and the product image list cache.
    await Promise.all([
      cacheDel(presignCacheKey(tenantId, image.objectName)),
      cacheDel(productImagesCacheKey(tenantId, productId)),
    ]);
    res.json({ message: "Image deleted" });
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
}
