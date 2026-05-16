CREATE TABLE "platform_settings" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "provider" text NOT NULL UNIQUE,
  "config" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "updated_by" uuid,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);
