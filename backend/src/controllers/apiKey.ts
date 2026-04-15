import { Request, Response } from "express";
import crypto from "crypto";
import { db } from "../db";
import { apiKeys, users } from "../db/schema";
import { eq, and } from "drizzle-orm";
import { createAuditLog } from "../services/audit";
import { handleControllerError } from "../utils/errors";
import { createKeySchema } from "../validators/apiKey";

function generateApiKey(): { raw: string; hash: string; prefix: string } {
  const raw = `sk_${crypto.randomBytes(32).toString("hex")}`;
  const prefix = raw.substring(0, 10);
  const hash = crypto.createHash("sha256").update(raw).digest("hex");
  return { raw, hash, prefix };
}

export const listApiKeys = async (req: Request, res: Response): Promise<void> => {
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
};

export const createApiKey = async (req: Request, res: Response): Promise<void> => {
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
    res.status(201).json({ ...key, rawKey: raw });
  } catch (error) {
    handleControllerError(error, res);
  }
};

export const revokeApiKey = async (req: Request, res: Response): Promise<void> => {
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
};
