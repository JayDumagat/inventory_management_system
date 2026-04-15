import { z } from "zod";

export const upsertIntegrationSchema = z.object({
  provider: z.string().min(1),
  isEnabled: z.boolean().optional(),
  webhookUrl: z.string().url().optional().or(z.literal("")),
  config: z.record(z.string(), z.unknown()).optional(),
});

export const SUPPORTED_PROVIDERS = [
  "shopify", "woocommerce", "quickbooks", "xero", "stripe",
  "paypal", "mailchimp", "slack", "zapier", "webhook",
  "minio", "redis",
];
