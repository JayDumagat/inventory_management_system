import { Request, Response } from "express";
import argon2 from "argon2";
import jwt from "jsonwebtoken";
import { db } from "../db";
import { superadminUsers } from "../db/schema";
import { eq } from "drizzle-orm";
import { handleControllerError } from "../utils/errors";
import { z } from "zod";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const createStaffSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  firstName: z.string().optional().default(""),
  lastName: z.string().optional().default(""),
  allowedPages: z.array(z.string()).optional().default([]),
});

const updateStaffSchema = z.object({
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  isActive: z.boolean().optional(),
  allowedPages: z.array(z.string()).optional(),
  password: z.string().min(8).optional(),
});

function generateSuperadminToken(id: string, email: string): string {
  return jwt.sign({ superadminId: id, email }, process.env.JWT_SECRET!, {
    expiresIn: "8h",
  });
}

// ─── Login ────────────────────────────────────────────────────────────────────
export async function superadminLogin(req: Request, res: Response): Promise<void> {
  try {
    const body = loginSchema.parse(req.body);

    const [sa] = await db
      .select()
      .from(superadminUsers)
      .where(eq(superadminUsers.email, body.email));

    if (!sa || !sa.isActive || !sa.passwordHash) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    const valid = await argon2.verify(sa.passwordHash, body.password);
    if (!valid) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    const accessToken = generateSuperadminToken(sa.id, sa.email);

    res.json({
      superadmin: {
        id: sa.id,
        email: sa.email,
        firstName: sa.firstName,
        lastName: sa.lastName,
        role: sa.role,
        allowedPages: sa.allowedPages ?? [],
      },
      accessToken,
    });
  } catch (error) {
    handleControllerError(error, res);
  }
}

// ─── Me ───────────────────────────────────────────────────────────────────────
export async function superadminMe(req: Request, res: Response): Promise<void> {
  const sa = req.superadmin!;
  const [row] = await db
    .select()
    .from(superadminUsers)
    .where(eq(superadminUsers.id, sa.id));
  if (!row) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json({
    id: row.id,
    email: row.email,
    firstName: row.firstName,
    lastName: row.lastName,
    role: row.role,
    allowedPages: row.allowedPages ?? [],
  });
}

// ─── List staff ───────────────────────────────────────────────────────────────
export async function listSuperadminStaff(req: Request, res: Response): Promise<void> {
  try {
    const rows = await db
      .select({
        id: superadminUsers.id,
        email: superadminUsers.email,
        firstName: superadminUsers.firstName,
        lastName: superadminUsers.lastName,
        role: superadminUsers.role,
        isActive: superadminUsers.isActive,
        allowedPages: superadminUsers.allowedPages,
        createdAt: superadminUsers.createdAt,
      })
      .from(superadminUsers);
    res.json(rows);
  } catch (error) {
    handleControllerError(error, res);
  }
}

// ─── Create staff ─────────────────────────────────────────────────────────────
export async function createSuperadminStaff(req: Request, res: Response): Promise<void> {
  try {
    const body = createStaffSchema.parse(req.body);

    const [existing] = await db
      .select({ id: superadminUsers.id })
      .from(superadminUsers)
      .where(eq(superadminUsers.email, body.email));
    if (existing) {
      res.status(409).json({ error: "Email already registered" });
      return;
    }

    const passwordHash = await argon2.hash(body.password);
    const [created] = await db
      .insert(superadminUsers)
      .values({
        email: body.email,
        passwordHash,
        firstName: body.firstName,
        lastName: body.lastName,
        role: "staff",
        allowedPages: body.allowedPages,
        createdBy: req.superadmin!.id,
      })
      .returning();

    res.status(201).json({
      id: created.id,
      email: created.email,
      firstName: created.firstName,
      lastName: created.lastName,
      role: created.role,
      isActive: created.isActive,
      allowedPages: created.allowedPages ?? [],
      createdAt: created.createdAt,
    });
  } catch (error) {
    handleControllerError(error, res);
  }
}

// ─── Update staff ─────────────────────────────────────────────────────────────
export async function updateSuperadminStaff(req: Request, res: Response): Promise<void> {
  try {
    const staffId = req.params.staffId as string;
    const body = updateStaffSchema.parse(req.body);

    const [existing] = await db
      .select()
      .from(superadminUsers)
      .where(eq(superadminUsers.id, staffId));
    if (!existing) {
      res.status(404).json({ error: "Staff member not found" });
      return;
    }

    // Cannot modify the owner account from this endpoint
    if (existing.role === "owner") {
      res.status(403).json({ error: "Cannot modify the platform owner account" });
      return;
    }

    const updates: Partial<typeof existing> & { updatedAt: Date } = { updatedAt: new Date() };
    if (body.firstName !== undefined) updates.firstName = body.firstName;
    if (body.lastName !== undefined) updates.lastName = body.lastName;
    if (body.isActive !== undefined) updates.isActive = body.isActive;
    if (body.allowedPages !== undefined) updates.allowedPages = body.allowedPages;
    if (body.password) updates.passwordHash = await argon2.hash(body.password);

    const [updated] = await db
      .update(superadminUsers)
      .set(updates)
      .where(eq(superadminUsers.id, staffId))
      .returning();

    res.json({
      id: updated.id,
      email: updated.email,
      firstName: updated.firstName,
      lastName: updated.lastName,
      role: updated.role,
      isActive: updated.isActive,
      allowedPages: updated.allowedPages ?? [],
    });
  } catch (error) {
    handleControllerError(error, res);
  }
}

// ─── Delete staff ─────────────────────────────────────────────────────────────
export async function deleteSuperadminStaff(req: Request, res: Response): Promise<void> {
  try {
    const staffId = req.params.staffId as string;

    const [existing] = await db
      .select()
      .from(superadminUsers)
      .where(eq(superadminUsers.id, staffId));
    if (!existing) {
      res.status(404).json({ error: "Staff member not found" });
      return;
    }
    if (existing.role === "owner") {
      res.status(403).json({ error: "Cannot delete the platform owner account" });
      return;
    }

    await db.delete(superadminUsers).where(eq(superadminUsers.id, staffId));
    res.json({ message: "Staff member deleted" });
  } catch (error) {
    handleControllerError(error, res);
  }
}
