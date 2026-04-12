import { Router, Request, Response } from "express";
import { z } from "zod";
import { db } from "../db";
import { integrations } from "../db/schema";
import { eq, and } from "drizzle-orm";
import { authenticate, requireTenant } from "../middleware/auth";
import { createAuditLog } from "../middleware/auditLog";

const router = Router({ mergeParams: true });

const SUPPORTED_PROVIDERS = [
  "shopify", "woocommerce", "quickbooks", "xero", "stripe",
  "paypal", "mailchimp", "slack", "zapier", "webhook",
];

const upsertSchema = z.object({
  provider: z.string().min(1),
  isEnabled: z.boolean().optional(),
  webhookUrl: z.string().url().optional().or(z.literal("")),
  config: z.record(z.string(), z.unknown()).optional(),
});

// GET /api/tenants/:tenantId/integrations
router.get("/", authenticate, requireTenant(), async (req: Request, res: Response): Promise<void> => {
  try {
    const stored = await db
      .select()
      .from(integrations)
      .where(eq(integrations.tenantId, req.tenantContext!.tenantId));

    // Merge stored with the full list of supported providers
    const storedMap = new Map(stored.map((i) => [i.provider, i]));
    const result = SUPPORTED_PROVIDERS.map((provider) =>
      storedMap.get(provider) ?? {
        id: null,
        tenantId: req.tenantContext!.tenantId,
        provider,
        isEnabled: false,
        config: {},
        webhookUrl: null,
        createdAt: null,
        updatedAt: null,
      }
    );
    res.json(result);
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

// PUT /api/tenants/:tenantId/integrations/:provider
router.put("/:provider", authenticate, requireTenant("admin"), async (req: Request, res: Response): Promise<void> => {
  try {
    const provider = req.params.provider as string;
    const body = upsertSchema.parse({ provider, ...req.body });

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
    res.json(integration);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: "Validation failed", details: error.issues });
      return;
    }
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
