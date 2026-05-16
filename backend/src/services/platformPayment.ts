import { eq } from "drizzle-orm";
import { db } from "../db";
import { platformSettings } from "../db/schema";
import { testIntegrationConnection } from "../lib/integrationHealth";

export async function ensurePlatformStripeReady(): Promise<{ ok: boolean; error?: string }> {
  const [stripe] = await db
    .select()
    .from(platformSettings)
    .where(eq(platformSettings.provider, "stripe"))
    .limit(1);

  if (!stripe) {
    return { ok: false, error: "Platform Stripe configuration is not set" };
  }

  const tested = await testIntegrationConnection("stripe", (stripe.config ?? {}) as Record<string, unknown>);
  if (!tested.ok) return { ok: false, error: tested.message };
  return { ok: true };
}
