-- Product: perishable flag + physical dimensions for industry-agnostic support
ALTER TABLE "products" ADD COLUMN "is_perishable" boolean DEFAULT false NOT NULL;
ALTER TABLE "products" ADD COLUMN "weight" numeric(10,3);
ALTER TABLE "products" ADD COLUMN "dimensions" text;

-- Staff account expiry: automatic access revocation after a configurable date
ALTER TABLE "tenant_users" ADD COLUMN "expires_at" timestamp;
