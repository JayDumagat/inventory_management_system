ALTER TABLE "tenants" ADD COLUMN "receipt_template" text DEFAULT 'compact' NOT NULL;
ALTER TABLE "tenants" ADD COLUMN "receipt_footer_message" text DEFAULT 'Thank you for your purchase!' NOT NULL;
