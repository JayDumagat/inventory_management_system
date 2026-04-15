-- Customers table
CREATE TABLE IF NOT EXISTS "customers" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "email" text,
  "phone" text,
  "address" text,
  "city" text,
  "country" text,
  "notes" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

-- Product images table
CREATE TABLE IF NOT EXISTS "product_images" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "product_id" uuid NOT NULL REFERENCES "products"("id") ON DELETE CASCADE,
  "object_name" text NOT NULL,
  "url" text NOT NULL,
  "alt_text" text,
  "sort_order" integer NOT NULL DEFAULT 0,
  "created_at" timestamp DEFAULT now() NOT NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS "idx_customers_tenant" ON "customers"("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_customers_name" ON "customers"("tenant_id", "name");
CREATE INDEX IF NOT EXISTS "idx_product_images_product" ON "product_images"("product_id");
