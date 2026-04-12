import { Router, Request, Response } from "express";
import { z } from "zod";
import { db } from "../db";
import { apiKeys, users } from "../db/schema";
import { eq, and } from "drizzle-orm";
import { authenticate, requireTenant } from "../middleware/auth";
import { createAuditLog } from "../middleware/auditLog";
import crypto from "crypto";

const router = Router({ mergeParams: true });

const createKeySchema = z.object({
  name: z.string().min(1),
  expiresAt: z.string().datetime().optional(),
});

function generateApiKey(): { raw: string; hash: string; prefix: string } {
  const raw = `sk_${crypto.randomBytes(32).toString("hex")}`;
  const prefix = raw.substring(0, 10);
  const hash = crypto.createHash("sha256").update(raw).digest("hex");
  return { raw, hash, prefix };
}

// GET /api/tenants/:tenantId/api-keys
router.get("/", authenticate, requireTenant("admin"), async (req: Request, res: Response): Promise<void> => {
  try {
    const keys = await db
      .select({
        id: apiKeys.id,
        name: apiKeys.name,
        keyPrefix: apiKeys.keyPrefix,
        isActive: apiKeys.isActive,
        expiresAt: apiKeys.expiresAt,
        lastUsedAt: apiKeys.lastUsedAt,
        createdAt: apiKeys.createdAt,
        createdByEmail: users.email,
      })
      .from(apiKeys)
      .leftJoin(users, eq(apiKeys.createdBy, users.id))
      .where(eq(apiKeys.tenantId, req.tenantContext!.tenantId));
    res.json(keys);
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/tenants/:tenantId/api-keys
router.post("/", authenticate, requireTenant("admin"), async (req: Request, res: Response): Promise<void> => {
  try {
    const body = createKeySchema.parse(req.body);
    const { raw, hash, prefix } = generateApiKey();

    const [key] = await db
      .insert(apiKeys)
      .values({
        tenantId: req.tenantContext!.tenantId,
        name: body.name,
        keyHash: hash,
        keyPrefix: prefix,
        isActive: true,
        expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
        createdBy: req.user!.id,
      })
      .returning();

    await createAuditLog({ tenantId: req.tenantContext!.tenantId, userId: req.user!.id, action: "create", resourceType: "api_key", resourceId: key.id });

    // Return the raw key only on creation — it will never be shown again
    res.status(201).json({ ...key, rawKey: raw });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: "Validation failed", details: error.issues });
      return;
    }
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/tenants/:tenantId/api-keys/:keyId  (revoke)
router.delete("/:keyId", authenticate, requireTenant("admin"), async (req: Request, res: Response): Promise<void> => {
  try {
    const [key] = await db
      .update(apiKeys)
      .set({ isActive: false })
      .where(and(eq(apiKeys.id, req.params.keyId as string), eq(apiKeys.tenantId, req.tenantContext!.tenantId)))
      .returning();
    if (!key) {
      res.status(404).json({ error: "API key not found" });
      return;
    }
    await createAuditLog({ tenantId: req.tenantContext!.tenantId, userId: req.user!.id, action: "delete", resourceType: "api_key", resourceId: key.id });
    res.json({ message: "API key revoked" });
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
