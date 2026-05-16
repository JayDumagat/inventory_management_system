import { Request, Response } from "express";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db";
import { platformSettings } from "../db/schema";
import { testIntegrationConnection } from "../lib/integrationHealth";
import { handleControllerError } from "../utils/errors";

const PROVIDERS = ["stripe", "smtp", "sms"] as const;
type PlatformProvider = (typeof PROVIDERS)[number];

const updateSettingsSchema = z.object({
  config: z.record(z.string(), z.unknown()),
});

function isProvider(value: string): value is PlatformProvider {
  return PROVIDERS.includes(value as PlatformProvider);
}

function maskSecrets(config: Record<string, unknown>): Record<string, unknown> {
  const secretKeys = new Set([
    "secretKey",
    "apiKey",
    "password",
    "authToken",
    "token",
    "accessToken",
    "storeName",
  ]);

  return Object.fromEntries(
    Object.entries(config).map(([key, value]) => {
      if (secretKeys.has(key) && value) return [key, "***"];
      return [key, value];
    }),
  );
}

function mapProviderForTest(provider: PlatformProvider): "stripe" | "smtp" | "twilio" {
  if (provider === "sms") return "twilio";
  return provider;
}

export async function listPlatformSettings(_req: Request, res: Response): Promise<void> {
  try {
    const all = await db.select().from(platformSettings);
    const map = new Map(all.map((row) => [row.provider, row]));

    const result = PROVIDERS.map((provider) => {
      const row = map.get(provider);
      if (!row) {
        return { provider, config: {}, createdAt: null, updatedAt: null };
      }
      return {
        provider,
        config: maskSecrets((row.config ?? {}) as Record<string, unknown>),
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      };
    });

    res.json(result);
  } catch (error) {
    handleControllerError(error, res);
  }
}

export async function upsertPlatformSetting(req: Request, res: Response): Promise<void> {
  try {
    const provider = req.params.provider as string;
    if (!isProvider(provider)) {
      res.status(400).json({ error: "Unsupported provider" });
      return;
    }

    const body = updateSettingsSchema.parse(req.body);
    const [existing] = await db
      .select()
      .from(platformSettings)
      .where(eq(platformSettings.provider, provider))
      .limit(1);

    let saved;
    if (existing) {
      [saved] = await db
        .update(platformSettings)
        .set({
          config: body.config,
          updatedBy: req.superadmin?.id,
          updatedAt: new Date(),
        })
        .where(eq(platformSettings.id, existing.id))
        .returning();
    } else {
      [saved] = await db
        .insert(platformSettings)
        .values({
          provider,
          config: body.config,
          updatedBy: req.superadmin?.id,
        })
        .returning();
    }

    res.json({
      provider: saved.provider,
      config: maskSecrets((saved.config ?? {}) as Record<string, unknown>),
      createdAt: saved.createdAt,
      updatedAt: saved.updatedAt,
    });
  } catch (error) {
    handleControllerError(error, res);
  }
}

export async function testPlatformSetting(req: Request, res: Response): Promise<void> {
  try {
    const provider = req.params.provider as string;
    if (!isProvider(provider)) {
      res.status(400).json({ error: "Unsupported provider" });
      return;
    }

    const [existing] = await db
      .select()
      .from(platformSettings)
      .where(eq(platformSettings.provider, provider))
      .limit(1);

    if (!existing) {
      res.status(400).json({ error: `${provider} configuration is not set` });
      return;
    }

    const result = await testIntegrationConnection(
      mapProviderForTest(provider),
      (existing.config ?? {}) as Record<string, unknown>,
    );
    if (!result.ok) {
      res.status(400).json(result);
      return;
    }
    res.json(result);
  } catch (error) {
    handleControllerError(error, res);
  }
}
