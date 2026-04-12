-- Add product type enum and column
DO $$ BEGIN
  CREATE TYPE "product_type" AS ENUM ('physical', 'digital', 'service', 'bundle');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "type" "product_type" NOT NULL DEFAULT 'physical';

-- Add allowed_pages to tenant_users
ALTER TABLE "tenant_users" ADD COLUMN IF NOT EXISTS "allowed_pages" jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Add plan to tenants
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "plan" text NOT NULL DEFAULT 'free';
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "plan_expires_at" timestamp;

-- Add invoice_status enum
DO $$ BEGIN
  CREATE TYPE "invoice_status" AS ENUM ('draft', 'sent', 'paid', 'overdue', 'cancelled');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- Invoices table
CREATE TABLE IF NOT EXISTS "invoices" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "order_id" uuid REFERENCES "sales_orders"("id") ON DELETE SET NULL,
  "branch_id" uuid REFERENCES "branches"("id") ON DELETE SET NULL,
  "invoice_number" text NOT NULL,
  "status" "invoice_status" NOT NULL DEFAULT 'draft',
  "customer_name" text,
  "customer_email" text,
  "customer_phone" text,
  "customer_address" text,
  "subtotal" numeric(10, 2) NOT NULL DEFAULT '0',
  "tax_amount" numeric(10, 2) NOT NULL DEFAULT '0',
  "discount_amount" numeric(10, 2) NOT NULL DEFAULT '0',
  "total_amount" numeric(10, 2) NOT NULL DEFAULT '0',
  "notes" text,
  "due_date" date,
  "paid_at" timestamp,
  "created_by" uuid REFERENCES "users"("id"),
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

-- Invoice items table
CREATE TABLE IF NOT EXISTS "invoice_items" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "invoice_id" uuid NOT NULL REFERENCES "invoices"("id") ON DELETE CASCADE,
  "description" text NOT NULL,
  "quantity" integer NOT NULL DEFAULT 1,
  "unit_price" numeric(10, 2) NOT NULL,
  "total_price" numeric(10, 2) NOT NULL,
  "created_at" timestamp NOT NULL DEFAULT now()
);
