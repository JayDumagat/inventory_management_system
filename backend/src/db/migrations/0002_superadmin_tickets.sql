-- Superadmin panel + support tickets migration
-- ─────────────────────────────────────────────────────────────────────────────

-- New enum types
CREATE TYPE "public"."superadmin_role" AS ENUM('owner', 'staff');--> statement-breakpoint
CREATE TYPE "public"."ticket_status" AS ENUM('open', 'in_progress', 'waiting_on_customer', 'resolved', 'closed');--> statement-breakpoint
CREATE TYPE "public"."ticket_priority" AS ENUM('low', 'medium', 'high', 'urgent');--> statement-breakpoint
CREATE TYPE "public"."ticket_category" AS ENUM('general', 'billing', 'technical', 'feature_request', 'bug_report', 'account');--> statement-breakpoint

-- ─── Superadmin users ─────────────────────────────────────────────────────────
CREATE TABLE "superadmin_users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password_hash" text,
	"first_name" text DEFAULT '' NOT NULL,
	"last_name" text DEFAULT '' NOT NULL,
	"role" "superadmin_role" DEFAULT 'staff' NOT NULL,
	"allowed_pages" jsonb DEFAULT '[]',
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "superadmin_users_email_unique" UNIQUE("email")
);
--> statement-breakpoint

-- ─── Superadmin roles ─────────────────────────────────────────────────────────
CREATE TABLE "superadmin_roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"allowed_pages" jsonb DEFAULT '[]' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "superadmin_roles_name_unique" UNIQUE("name")
);
--> statement-breakpoint

-- ─── Support tickets ──────────────────────────────────────────────────────────
CREATE TABLE "support_tickets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_number" text NOT NULL,
	"tenant_id" uuid,
	"submitted_by_user_id" uuid,
	"submitter_email" text NOT NULL,
	"submitter_name" text,
	"category" "ticket_category" DEFAULT 'general' NOT NULL,
	"priority" "ticket_priority" DEFAULT 'medium' NOT NULL,
	"subject" text NOT NULL,
	"status" "ticket_status" DEFAULT 'open' NOT NULL,
	"assigned_to" uuid,
	"resolved_at" timestamp,
	"closed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "support_tickets_ticket_number_unique" UNIQUE("ticket_number")
);
--> statement-breakpoint

-- ─── Ticket messages ──────────────────────────────────────────────────────────
CREATE TABLE "ticket_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_id" uuid NOT NULL,
	"sender_type" text NOT NULL,
	"sender_id" uuid,
	"sender_email" text,
	"sender_name" text,
	"body" text NOT NULL,
	"is_internal" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint

-- ─── Foreign keys ─────────────────────────────────────────────────────────────
ALTER TABLE "ticket_messages" ADD CONSTRAINT "ticket_messages_ticket_id_support_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."support_tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
