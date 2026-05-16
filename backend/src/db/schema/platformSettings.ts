import { pgTable, uuid, text, timestamp, jsonb } from "drizzle-orm/pg-core";

export const platformSettings = pgTable("platform_settings", {
  id: uuid("id").primaryKey().defaultRandom(),
  provider: text("provider").notNull().unique(),
  config: jsonb("config").$type<Record<string, unknown>>().notNull().default({}),
  updatedBy: uuid("updated_by"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
