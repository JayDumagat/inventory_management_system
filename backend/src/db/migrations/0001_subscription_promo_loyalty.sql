-- Subscription / Promotions / Loyalty schema migration
-- ─────────────────────────────────────────────────────────────────────────────

-- New enum types
CREATE TYPE "public"."subscription_status" AS ENUM('active', 'trialing', 'overdue', 'canceled', 'paused');--> statement-breakpoint
CREATE TYPE "public"."promotion_type" AS ENUM('percentage_off', 'fixed_amount', 'bogo', 'free_shipping', 'tiered');--> statement-breakpoint
CREATE TYPE "public"."promotion_discount_type" AS ENUM('percentage', 'fixed');--> statement-breakpoint
CREATE TYPE "public"."loyalty_tx_type" AS ENUM('earn', 'redeem', 'adjust', 'expire');--> statement-breakpoint

-- ─── Plan catalog ─────────────────────────────────────────────────────────────
CREATE TABLE "plan_catalog" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"monthly_price" numeric(10, 2) DEFAULT '0' NOT NULL,
	"annual_price" numeric(10, 2) DEFAULT '0' NOT NULL,
	"limits" jsonb DEFAULT '{}' NOT NULL,
	"features" jsonb DEFAULT '[]' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "plan_catalog_key_unique" UNIQUE("key")
);
--> statement-breakpoint

-- ─── Tenant subscriptions ─────────────────────────────────────────────────────
CREATE TABLE "tenant_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"plan_key" text DEFAULT 'free' NOT NULL,
	"status" "subscription_status" DEFAULT 'active' NOT NULL,
	"current_period_start" timestamp DEFAULT now() NOT NULL,
	"current_period_end" timestamp,
	"cancel_at_period_end" boolean DEFAULT false NOT NULL,
	"trial_ends_at" timestamp,
	"addon_limits" jsonb DEFAULT '{}' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "tenant_subscriptions_tenant_id_unique" UNIQUE("tenant_id")
);
--> statement-breakpoint

-- ─── Subscription add-ons ─────────────────────────────────────────────────────
CREATE TABLE "subscription_addons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"addon_key" text NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint

-- ─── Subscription history ─────────────────────────────────────────────────────
CREATE TABLE "subscription_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"from_plan" text NOT NULL,
	"to_plan" text NOT NULL,
	"reason" text,
	"changed_by" uuid,
	"effective_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint

-- ─── Promotions ───────────────────────────────────────────────────────────────
CREATE TABLE "promotions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"code" text,
	"type" "promotion_type" NOT NULL,
	"discount_type" "promotion_discount_type" NOT NULL,
	"discount_value" numeric(10, 2) NOT NULL,
	"minimum_order_amount" numeric(10, 2),
	"maximum_discount_amount" numeric(10, 2),
	"buy_quantity" integer,
	"get_quantity" integer,
	"scope" text DEFAULT 'order' NOT NULL,
	"applicable_category_ids" jsonb DEFAULT '[]',
	"eligibility" text DEFAULT 'all' NOT NULL,
	"specific_customer_id" uuid,
	"usage_limit_total" integer,
	"usage_limit_per_customer" integer,
	"usage_count" integer DEFAULT 0 NOT NULL,
	"starts_at" timestamp,
	"ends_at" timestamp,
	"is_active" boolean DEFAULT true NOT NULL,
	"stackable" boolean DEFAULT false NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"created_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint

-- ─── Promotion usage log ──────────────────────────────────────────────────────
CREATE TABLE "promotion_usage" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"promotion_id" uuid NOT NULL,
	"tenant_id" uuid NOT NULL,
	"order_id" uuid,
	"customer_id" uuid,
	"discount_applied" numeric(10, 2) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint

-- ─── Loyalty configuration ────────────────────────────────────────────────────
CREATE TABLE "loyalty_config" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"is_enabled" boolean DEFAULT false NOT NULL,
	"points_per_dollar" numeric(10, 4) DEFAULT '1' NOT NULL,
	"points_per_redemption_dollar" numeric(10, 4) DEFAULT '100' NOT NULL,
	"minimum_points_to_redeem" integer DEFAULT 100 NOT NULL,
	"maximum_redeem_percent" integer DEFAULT 50 NOT NULL,
	"points_expire_days" integer,
	"program_name" text DEFAULT 'Loyalty Rewards' NOT NULL,
	"points_label" text DEFAULT 'points' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "loyalty_config_tenant_id_unique" UNIQUE("tenant_id")
);
--> statement-breakpoint

-- ─── Loyalty ledger ───────────────────────────────────────────────────────────
CREATE TABLE "loyalty_ledger" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"order_id" uuid,
	"type" "loyalty_tx_type" NOT NULL,
	"points" integer NOT NULL,
	"balance_before" integer NOT NULL,
	"balance_after" integer NOT NULL,
	"notes" text,
	"expires_at" timestamp,
	"created_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint

-- ─── Foreign key constraints ──────────────────────────────────────────────────
ALTER TABLE "tenant_subscriptions" ADD CONSTRAINT "tenant_subscriptions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_addons" ADD CONSTRAINT "subscription_addons_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_history" ADD CONSTRAINT "subscription_history_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_history" ADD CONSTRAINT "subscription_history_changed_by_users_id_fk" FOREIGN KEY ("changed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promotions" ADD CONSTRAINT "promotions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promotions" ADD CONSTRAINT "promotions_specific_customer_id_customers_id_fk" FOREIGN KEY ("specific_customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promotions" ADD CONSTRAINT "promotions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promotion_usage" ADD CONSTRAINT "promotion_usage_promotion_id_promotions_id_fk" FOREIGN KEY ("promotion_id") REFERENCES "public"."promotions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promotion_usage" ADD CONSTRAINT "promotion_usage_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promotion_usage" ADD CONSTRAINT "promotion_usage_order_id_sales_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."sales_orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promotion_usage" ADD CONSTRAINT "promotion_usage_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loyalty_config" ADD CONSTRAINT "loyalty_config_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loyalty_ledger" ADD CONSTRAINT "loyalty_ledger_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loyalty_ledger" ADD CONSTRAINT "loyalty_ledger_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loyalty_ledger" ADD CONSTRAINT "loyalty_ledger_order_id_sales_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."sales_orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loyalty_ledger" ADD CONSTRAINT "loyalty_ledger_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint

-- ─── Alter existing tables ────────────────────────────────────────────────────
ALTER TABLE "customers" ADD COLUMN "loyalty_points" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "sales_orders" ADD COLUMN "promotion_id" uuid;--> statement-breakpoint
ALTER TABLE "sales_orders" ADD COLUMN "promotion_code" text;--> statement-breakpoint
ALTER TABLE "sales_orders" ADD COLUMN "loyalty_points_earned" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "sales_orders" ADD COLUMN "loyalty_points_redeemed" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "sales_orders" ADD COLUMN "loyalty_discount_amount" numeric(10, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint

-- ─── Seed plan catalog ────────────────────────────────────────────────────────
INSERT INTO "plan_catalog" ("key", "name", "monthly_price", "annual_price", "limits", "features") VALUES
  ('free', 'Free', '0', '0',
   '{"branches": 1, "products": 100, "api_keys": 0, "invoices_per_month": 0}',
   '["pos", "products", "inventory", "sales_orders", "categories", "units", "customers", "audit_log", "reports_basic", "dashboard"]'),
  ('pro', 'Pro', '29', '290',
   '{"branches": 5, "products": -1, "api_keys": 10, "invoices_per_month": 100}',
   '["pos", "products", "inventory", "sales_orders", "categories", "units", "customers", "audit_log", "reports_basic", "reports_advanced", "analytics", "invoices", "api_keys", "integrations", "purchase_orders", "suppliers", "batches", "dashboard", "promotions", "loyalty"]'),
  ('enterprise', 'Enterprise', '99', '990',
   '{"branches": -1, "products": -1, "api_keys": -1, "invoices_per_month": -1}',
   '["pos", "products", "inventory", "sales_orders", "categories", "units", "customers", "audit_log", "reports_basic", "reports_advanced", "analytics", "invoices", "api_keys", "integrations", "purchase_orders", "suppliers", "batches", "dashboard", "white_label", "custom_integrations", "sla"]');
--> statement-breakpoint

-- Backfill: create a subscription record for every existing tenant
INSERT INTO "tenant_subscriptions" ("tenant_id", "plan_key", "status")
SELECT "id", "plan", 'active'
FROM "tenants"
ON CONFLICT ("tenant_id") DO NOTHING;
