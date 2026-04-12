import { Router, Request, Response } from "express";
import { z } from "zod";
import argon2 from "argon2";
import crypto from "crypto";
import { db } from "../db";
import { users, tenantUsers, branches, branchStaff } from "../db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { authenticate, requireTenant } from "../middleware/auth";
import { createAuditLog } from "../middleware/auditLog";

const router = Router({ mergeParams: true });

// GET /api/tenants/:tenantId/staff
router.get("/", authenticate, requireTenant("manager"), async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = req.tenantContext!.tenantId;

    const members = await db
      .select({
        tenantUserId: tenantUsers.id,
        userId: tenantUsers.userId,
        role: tenantUsers.role,
        isActive: tenantUsers.isActive,
        createdAt: tenantUsers.createdAt,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
      })
      .from(tenantUsers)
      .innerJoin(users, eq(tenantUsers.userId, users.id))
      .where(eq(tenantUsers.tenantId, tenantId));

    // Fetch branch assignments for each member
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
});

// POST /api/tenants/:tenantId/staff — invite staff by email
router.post("/", authenticate, requireTenant("admin"), async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = req.tenantContext!.tenantId;
    const body = z.object({
      email: z.string().email(),
      role: z.enum(["staff", "manager", "admin"]).default("staff"),
      firstName: z.string().optional(),
      lastName: z.string().optional(),
    }).parse(req.body);

    // Find or create user
    let [user] = await db.select().from(users).where(eq(users.email, body.email));
    if (!user) {
      // Create a placeholder user (they can set password via forgot-password)
      const tempHash = await argon2.hash(crypto.randomBytes(32).toString("hex"));
      [user] = await db.insert(users).values({
        email: body.email,
        passwordHash: tempHash,
        firstName: body.firstName || "",
        lastName: body.lastName || "",
      }).returning();
    }

    // Check if already a member
    const [existing] = await db
      .select()
      .from(tenantUsers)
      .where(and(eq(tenantUsers.tenantId, tenantId), eq(tenantUsers.userId, user.id)));

    if (existing) {
      if (existing.isActive) {
        res.status(409).json({ error: "User is already a member of this organization" });
        return;
      }
      // Reactivate
      const [updated] = await db
        .update(tenantUsers)
        .set({ role: body.role, isActive: true, updatedAt: new Date() })
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

    await createAuditLog({
      tenantId,
      userId: req.user!.id,
      action: "create",
      resourceType: "staff",
      resourceId: tenantUser.id,
      newValues: { email: body.email, role: body.role },
    });

    res.status(201).json({ ...tenantUser, email: user.email, firstName: user.firstName, lastName: user.lastName });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: "Validation failed", details: error.issues });
      return;
    }
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /api/tenants/:tenantId/staff/:staffId
router.patch("/:staffId", authenticate, requireTenant("admin"), async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = req.tenantContext!.tenantId;
    const staffId = req.params.staffId as string;

    const body = z.object({
      role: z.enum(["staff", "manager", "admin"]).optional(),
      isActive: z.boolean().optional(),
    }).parse(req.body);

    const [existing] = await db
      .select()
      .from(tenantUsers)
      .where(and(eq(tenantUsers.id, staffId), eq(tenantUsers.tenantId, tenantId)));

    if (!existing) {
      res.status(404).json({ error: "Staff member not found" });
      return;
    }

    // Prevent demoting/removing owner
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
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: "Validation failed", details: error.issues });
      return;
    }
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/tenants/:tenantId/staff/:staffId
router.delete("/:staffId", authenticate, requireTenant("admin"), async (req: Request, res: Response): Promise<void> => {
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

    // Remove branch assignments first
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
});

// GET /api/tenants/:tenantId/staff/:staffId/branches
router.get("/:staffId/branches", authenticate, requireTenant("manager"), async (req: Request, res: Response): Promise<void> => {
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
});

// POST /api/tenants/:tenantId/staff/:staffId/branches
router.post("/:staffId/branches", authenticate, requireTenant("manager"), async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = req.tenantContext!.tenantId;
    const staffId = req.params.staffId as string;
    const { branchId } = z.object({ branchId: z.string().uuid() }).parse(req.body);

    const [existing] = await db
      .select()
      .from(tenantUsers)
      .where(and(eq(tenantUsers.id, staffId), eq(tenantUsers.tenantId, tenantId)));

    if (!existing) {
      res.status(404).json({ error: "Staff member not found" });
      return;
    }

    // Verify branch belongs to tenant
    const [branch] = await db
      .select()
      .from(branches)
      .where(and(eq(branches.id, branchId), eq(branches.tenantId, tenantId)));

    if (!branch) {
      res.status(404).json({ error: "Branch not found" });
      return;
    }

    // Check if already assigned
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
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: "Validation failed", details: error.issues });
      return;
    }
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/tenants/:tenantId/staff/:staffId/branches/:branchId
router.delete("/:staffId/branches/:branchId", authenticate, requireTenant("manager"), async (req: Request, res: Response): Promise<void> => {
  try {
    const staffId = req.params.staffId as string;
    const branchId = req.params.branchId as string;

    await db.delete(branchStaff).where(and(eq(branchStaff.tenantUserId, staffId), eq(branchStaff.branchId, branchId)));
    res.json({ message: "Branch assignment removed" });
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
