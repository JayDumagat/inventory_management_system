ALTER TABLE "tenants" ADD COLUMN "receipt_logo_url" text;
ALTER TABLE "tenants" ADD COLUMN "receipt_show_logo" boolean DEFAULT false NOT NULL;
ALTER TABLE "products" ADD COLUMN "track_stock" boolean DEFAULT true NOT NULL;
