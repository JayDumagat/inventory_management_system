import { Request, Response } from "express";
import { db } from "../db";
import { integrations } from "../db/schema";
import { eq, and } from "drizzle-orm";
import { createAuditLog } from "../services/audit";
import { handleControllerError } from "../utils/errors";
import { upsertIntegrationSchema, SUPPORTED_PROVIDERS } from "../validators/integration";
import { cacheGet, cacheSet, cacheDel } from "../lib/redis";

export const listIntegrations = async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = req.tenantContext!.tenantId;
    const cacheKey = `integrations:${tenantId}`;

    const cached = await cacheGet<object[]>(cacheKey);
    if (cached) {
      res.json(cached);
      return;
    }

    const stored = await db
      .select()
      .from(integrations)
      .where(eq(integrations.tenantId, tenantId));

    const storedMap = new Map(stored.map((i) => [i.provider, i]));
    const result = SUPPORTED_PROVIDERS.map((provider) =>
      storedMap.get(provider) ?? {
        id: null,
        tenantId: tenantId,
        provider,
        isEnabled: false,
        config: {},
        webhookUrl: null,
        createdAt: null,
        updatedAt: null,
      }
    );

    await cacheSet(cacheKey, result, 120);
    res.json(result);
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
};

export const upsertIntegration = async (req: Request, res: Response): Promise<void> => {
  try {
    const provider = req.params.provider as string;
    const body = upsertIntegrationSchema.parse({ provider, ...req.body });

    const [existing] = await db
      .select()
      .from(integrations)
      .where(and(eq(integrations.tenantId, req.tenantContext!.tenantId), eq(integrations.provider, provider)));

    let integration;
    if (existing) {
      [integration] = await db
        .update(integrations)
        .set({
          isEnabled: body.isEnabled ?? existing.isEnabled,
          webhookUrl: body.webhookUrl !== undefined ? (body.webhookUrl || null) : existing.webhookUrl,
          config: body.config !== undefined ? body.config : (existing.config as Record<string, unknown>),
          updatedAt: new Date(),
        })
        .where(eq(integrations.id, existing.id))
        .returning();
    } else {
      [integration] = await db
        .insert(integrations)
        .values({
          tenantId: req.tenantContext!.tenantId,
          provider,
          isEnabled: body.isEnabled ?? false,
          webhookUrl: body.webhookUrl || null,
          config: body.config ?? {},
        })
        .returning();
    }

    await createAuditLog({ tenantId: req.tenantContext!.tenantId, userId: req.user!.id, action: "update", resourceType: "integration", resourceId: integration.id });
    await cacheDel(`integrations:${req.tenantContext!.tenantId}`);
    res.json(integration);
  } catch (error) {
    handleControllerError(error, res);
  }
};
