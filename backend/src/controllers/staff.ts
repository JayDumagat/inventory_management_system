import { Request, Response } from "express";
import argon2 from "argon2";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { db } from "../db";
import { users, tenantUsers, branches, branchStaff } from "../db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { createAuditLog } from "../services/audit";
import { handleControllerError } from "../utils/errors";
import { inviteStaffSchema, updateStaffSchema, assignBranchSchema } from "../validators/staff";

export const listStaff = async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = req.tenantContext!.tenantId;

    const members = await db
      .select({
        tenantUserId: tenantUsers.id,
        userId: tenantUsers.userId,
        role: tenantUsers.role,
        isActive: tenantUsers.isActive,
        allowedPages: tenantUsers.allowedPages,
        createdAt: tenantUsers.createdAt,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
      })
      .from(tenantUsers)
      .innerJoin(users, eq(tenantUsers.userId, users.id))
      .where(eq(tenantUsers.tenantId, tenantId));

    const tenantUserIds = members.map((m) => m.tenantUserId);
    const assignments =
      tenantUserIds.length > 0
        ? await db
            .select({
              tenantUserId: branchStaff.tenantUserId,
              branchId: branchStaff.branchId,
              branchName: branches.name,
            })
            .from(branchStaff)
            .innerJoin(branches, eq(branchStaff.branchId, branches.id))
            .where(inArray(branchStaff.tenantUserId, tenantUserIds))
        : [];

    const result = members.map((m) => ({
      ...m,
      branches: assignments.filter((a) => a.tenantUserId === m.tenantUserId).map((a) => ({
        id: a.branchId,
        name: a.branchName,
      })),
    }));

    res.json(result);
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
};

export const inviteStaff = async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = req.tenantContext!.tenantId;
    const body = inviteStaffSchema.parse(req.body);

    let [user] = await db.select().from(users).where(eq(users.email, body.email));
    let inviteToken: string | undefined;
    const isNewUser = !user;
    const explicitPasswordProvided = Boolean(body.password && body.password.trim().length > 0);
    if (!user) {
      const tempHash = await argon2.hash(explicitPasswordProvided ? body.password! : crypto.randomBytes(32).toString("hex"));
      [user] = await db.insert(users).values({
        email: body.email,
        passwordHash: tempHash,
        firstName: body.firstName || "",
        lastName: body.lastName || "",
      }).returning();
    }

    const [existing] = await db
      .select()
      .from(tenantUsers)
      .where(and(eq(tenantUsers.tenantId, tenantId), eq(tenantUsers.userId, user.id)));

    if (existing) {
      if (existing.isActive) {
        res.status(409).json({ error: "User is already a member of this organization" });
        return;
      }
      const updateValues: { role: "staff" | "manager" | "admin"; isActive: true; updatedAt: Date } = {
        role: body.role,
        isActive: true,
        updatedAt: new Date(),
      };
      if (explicitPasswordProvided) {
        await db.update(users)
          .set({ passwordHash: await argon2.hash(body.password!), updatedAt: new Date() })
          .where(eq(users.id, user.id));
      }
      const [updated] = await db
        .update(tenantUsers)
        .set(updateValues)
        .where(eq(tenantUsers.id, existing.id))
        .returning();
      res.status(201).json({ ...updated, email: user.email, firstName: user.firstName, lastName: user.lastName });
      return;
    }

    const [tenantUser] = await db.insert(tenantUsers).values({
      tenantId,
      userId: user.id,
      role: body.role,
    }).returning();

    // Generate an invite token for newly-created users so they can complete registration
    if (isNewUser && !explicitPasswordProvided) {
      inviteToken = jwt.sign(
        { userId: user.id, tenantId, type: "staff-invite" },
        process.env.JWT_SECRET!,
        { expiresIn: "7d" },
      );
    }

    await createAuditLog({
      tenantId,
      userId: req.user!.id,
      action: "create",
      resourceType: "staff",
      resourceId: tenantUser.id,
      newValues: { email: body.email, role: body.role },
    });

    res.status(201).json({ ...tenantUser, email: user.email, firstName: user.firstName, lastName: user.lastName, inviteToken });
  } catch (error) {
    handleControllerError(error, res);
  }
};

export const updateStaff = async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = req.tenantContext!.tenantId;
    const staffId = req.params.staffId as string;

    const body = updateStaffSchema.parse(req.body);

    const [existing] = await db
      .select()
      .from(tenantUsers)
      .where(and(eq(tenantUsers.id, staffId), eq(tenantUsers.tenantId, tenantId)));

    if (!existing) {
      res.status(404).json({ error: "Staff member not found" });
      return;
    }

    if (existing.role === "owner") {
      res.status(403).json({ error: "Cannot modify the organization owner" });
      return;
    }

    const [updated] = await db
      .update(tenantUsers)
      .set({ ...body, updatedAt: new Date() })
      .where(eq(tenantUsers.id, staffId))
      .returning();

    res.json(updated);
  } catch (error) {
    handleControllerError(error, res);
  }
};

export const deleteStaff = async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = req.tenantContext!.tenantId;
    const staffId = req.params.staffId as string;

    const [existing] = await db
      .select()
      .from(tenantUsers)
      .where(and(eq(tenantUsers.id, staffId), eq(tenantUsers.tenantId, tenantId)));

    if (!existing) {
      res.status(404).json({ error: "Staff member not found" });
      return;
    }

    if (existing.role === "owner") {
      res.status(403).json({ error: "Cannot remove the organization owner" });
      return;
    }

    await db.delete(branchStaff).where(eq(branchStaff.tenantUserId, staffId));
    await db.delete(tenantUsers).where(eq(tenantUsers.id, staffId));

    await createAuditLog({
      tenantId,
      userId: req.user!.id,
      action: "delete",
      resourceType: "staff",
      resourceId: staffId,
    });

    res.json({ message: "Staff member removed" });
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
};

export const listStaffBranches = async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = req.tenantContext!.tenantId;
    const staffId = req.params.staffId as string;

    const [existing] = await db
      .select()
      .from(tenantUsers)
      .where(and(eq(tenantUsers.id, staffId), eq(tenantUsers.tenantId, tenantId)));

    if (!existing) {
      res.status(404).json({ error: "Staff member not found" });
      return;
    }

    const assignments = await db
      .select({ id: branchStaff.id, branchId: branches.id, branchName: branches.name })
      .from(branchStaff)
      .innerJoin(branches, eq(branchStaff.branchId, branches.id))
      .where(eq(branchStaff.tenantUserId, staffId));

    res.json(assignments);
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
};

export const assignStaffBranch = async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = req.tenantContext!.tenantId;
    const staffId = req.params.staffId as string;
    const { branchId } = assignBranchSchema.parse(req.body);

    const [existing] = await db
      .select()
      .from(tenantUsers)
      .where(and(eq(tenantUsers.id, staffId), eq(tenantUsers.tenantId, tenantId)));

    if (!existing) {
      res.status(404).json({ error: "Staff member not found" });
      return;
    }

    const [branch] = await db
      .select()
      .from(branches)
      .where(and(eq(branches.id, branchId), eq(branches.tenantId, tenantId)));

    if (!branch) {
      res.status(404).json({ error: "Branch not found" });
      return;
    }

    const [alreadyAssigned] = await db
      .select()
      .from(branchStaff)
      .where(and(eq(branchStaff.tenantUserId, staffId), eq(branchStaff.branchId, branchId)));

    if (alreadyAssigned) {
      res.status(409).json({ error: "Staff already assigned to this branch" });
      return;
    }

    const [assignment] = await db.insert(branchStaff).values({ branchId, tenantUserId: staffId }).returning();
    res.status(201).json(assignment);
  } catch (error) {
    handleControllerError(error, res);
  }
};

export const removeStaffBranch = async (req: Request, res: Response): Promise<void> => {
  try {
    const staffId = req.params.staffId as string;
    const branchId = req.params.branchId as string;

    await db.delete(branchStaff).where(and(eq(branchStaff.tenantUserId, staffId), eq(branchStaff.branchId, branchId)));
    res.json({ message: "Branch assignment removed" });
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
};
