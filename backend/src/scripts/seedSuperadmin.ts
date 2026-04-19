/**
 * Bootstrap script: creates the initial platform owner account.
 * Usage: tsx src/scripts/seedSuperadmin.ts
 *
 * Environment variables:
 *   SUPERADMIN_EMAIL    - owner email (required)
 *   SUPERADMIN_PASSWORD - owner password (required, min 8 chars)
 */

import * as dotenv from "dotenv";
dotenv.config();

import argon2 from "argon2";
import { db } from "../db";
import { superadminUsers } from "../db/schema";
import { eq } from "drizzle-orm";

async function main() {
  const email = process.env.SUPERADMIN_EMAIL;
  const password = process.env.SUPERADMIN_PASSWORD;

  if (!email || !password) {
    console.error("Error: SUPERADMIN_EMAIL and SUPERADMIN_PASSWORD must be set.");
    process.exit(1);
  }
  if (password.length < 8) {
    console.error("Error: SUPERADMIN_PASSWORD must be at least 8 characters.");
    process.exit(1);
  }

  const [existing] = await db
    .select({ id: superadminUsers.id, role: superadminUsers.role })
    .from(superadminUsers)
    .where(eq(superadminUsers.email, email));

  if (existing) {
    if (existing.role === "owner") {
      console.log(`✓ Platform owner already exists: ${email}`);
    } else {
      // Promote to owner
      await db
        .update(superadminUsers)
        .set({ role: "owner", updatedAt: new Date() })
        .where(eq(superadminUsers.id, existing.id));
      console.log(`✓ Promoted ${email} to platform owner.`);
    }
    process.exit(0);
  }

  const passwordHash = await argon2.hash(password);
  await db.insert(superadminUsers).values({
    email,
    passwordHash,
    firstName: "Platform",
    lastName: "Owner",
    role: "owner",
    allowedPages: [],
  });

  console.log(`✓ Platform owner created: ${email}`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
