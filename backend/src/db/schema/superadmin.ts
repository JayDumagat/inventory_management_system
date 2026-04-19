import { pgTable, uuid, text, timestamp, boolean, jsonb } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { superadminRoleEnum, ticketStatusEnum, ticketPriorityEnum, ticketCategoryEnum } from "./enums";

// ─── Superadmin users ────────────────────────────────────────────────────────
export const superadminUsers = pgTable("superadmin_users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash"),
  firstName: text("first_name").notNull().default(""),
  lastName: text("last_name").notNull().default(""),
  role: superadminRoleEnum("role").notNull().default("staff"),
  // pages this staff member can access; null/empty = owner (all pages)
  allowedPages: jsonb("allowed_pages").$type<string[]>().default([]),
  isActive: boolean("is_active").notNull().default(true),
  createdBy: uuid("created_by"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ─── Superadmin roles (custom named roles) ───────────────────────────────────
export const superadminRoles = pgTable("superadmin_roles", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
  description: text("description"),
  allowedPages: jsonb("allowed_pages").$type<string[]>().notNull().default([]),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ─── Support tickets (submitted by tenant users) ─────────────────────────────
export const supportTickets = pgTable("support_tickets", {
  id: uuid("id").primaryKey().defaultRandom(),
  ticketNumber: text("ticket_number").notNull().unique(),
  tenantId: uuid("tenant_id"),
  submittedByUserId: uuid("submitted_by_user_id"),
  submitterEmail: text("submitter_email").notNull(),
  submitterName: text("submitter_name"),
  category: ticketCategoryEnum("category").notNull().default("general"),
  priority: ticketPriorityEnum("priority").notNull().default("medium"),
  subject: text("subject").notNull(),
  status: ticketStatusEnum("status").notNull().default("open"),
  assignedTo: uuid("assigned_to"),
  resolvedAt: timestamp("resolved_at"),
  closedAt: timestamp("closed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ─── Ticket messages ─────────────────────────────────────────────────────────
export const ticketMessages = pgTable("ticket_messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  ticketId: uuid("ticket_id").notNull().references(() => supportTickets.id, { onDelete: "cascade" }),
  senderType: text("sender_type").notNull(), // "tenant_user" | "superadmin"
  senderId: uuid("sender_id"),
  senderEmail: text("sender_email"),
  senderName: text("sender_name"),
  body: text("body").notNull(),
  isInternal: boolean("is_internal").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ─── Relations ───────────────────────────────────────────────────────────────
export const supportTicketsRelations = relations(supportTickets, ({ many, one }) => ({
  messages: many(ticketMessages),
  assignee: one(superadminUsers, {
    fields: [supportTickets.assignedTo],
    references: [superadminUsers.id],
  }),
}));

export const ticketMessagesRelations = relations(ticketMessages, ({ one }) => ({
  ticket: one(supportTickets, {
    fields: [ticketMessages.ticketId],
    references: [supportTickets.id],
  }),
}));
