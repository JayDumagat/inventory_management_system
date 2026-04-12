import { Router, Request, Response } from "express";
import { z } from "zod";
import { db } from "../db";
import { tenants, tenantUsers, branches } from "../db/schema";
import { eq, and } from "drizzle-orm";
import { authenticate } from "../middleware/auth";
import { createAuditLog } from "../middleware/auditLog";

const router = Router();

const createTenantSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/, "Slug must be lowercase alphanumeric with dashes"),
  description: z.string().optional(),
  logoUrl: z.string().url().optional().or(z.literal("")),
});

const updateTenantSchema = createTenantSchema.partial().extend({
  plan: z.enum(["free", "pro", "enterprise"]).optional(),
});

// GET /api/tenants - list user's tenants
router.get("/", authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const userTenants = await db
      .select({
        id: tenants.id,
        name: tenants.name,
        slug: tenants.slug,
        description: tenants.description,
        logoUrl: tenants.logoUrl,
        isActive: tenants.isActive,
        createdAt: tenants.createdAt,
        role: tenantUsers.role,
      })
      .from(tenantUsers)
      .innerJoin(tenants, eq(tenantUsers.tenantId, tenants.id))
      .where(and(eq(tenantUsers.userId, req.user!.id), eq(tenantUsers.isActive, true)));
    
    res.json(userTenants);
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/tenants - create tenant
router.post("/", authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const body = createTenantSchema.parse(req.body);
    
    const [existing] = await db.select().from(tenants).where(eq(tenants.slug, body.slug));
    if (existing) {
      res.status(409).json({ error: "Slug already taken" });
      return;
    }

    const [tenant] = await db.insert(tenants).values(body).returning();
    
    // Make creator the owner
    await db.insert(tenantUsers).values({
      tenantId: tenant.id,
      userId: req.user!.id,
      role: "owner",
    });

    // Create default branch
    await db.insert(branches).values({
      tenantId: tenant.id,
      name: "Main Branch",
      isDefault: true,
    });

    await createAuditLog({
      tenantId: tenant.id,
      userId: req.user!.id,
      action: "create",
      resourceType: "tenant",
      resourceId: tenant.id,
      newValues: body,
    });

    res.status(201).json(tenant);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: "Validation failed", details: error.issues });
      return;
    }
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/tenants/:tenantId
router.get("/:tenantId", authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = req.params.tenantId as string;
    const [tenantUser] = await db
      .select()
      .from(tenantUsers)
      .where(and(eq(tenantUsers.tenantId, tenantId), eq(tenantUsers.userId, req.user!.id)));
    if (!tenantUser) {
      res.status(403).json({ error: "Access denied" });
      return;
    }
    
    const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId));
    if (!tenant) {
      res.status(404).json({ error: "Tenant not found" });
      return;
    }
    
    res.json({ ...tenant, role: tenantUser.role });
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /api/tenants/:tenantId
router.patch("/:tenantId", authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = req.params.tenantId as string;
    const [tenantUser] = await db
      .select()
      .from(tenantUsers)
      .where(and(eq(tenantUsers.tenantId, tenantId), eq(tenantUsers.userId, req.user!.id)));
    if (!tenantUser || !["owner", "admin"].includes(tenantUser.role)) {
      res.status(403).json({ error: "Insufficient permissions" });
      return;
    }

    const body = updateTenantSchema.parse(req.body);
    const [updated] = await db.update(tenants).set({ ...body, updatedAt: new Date() }).where(eq(tenants.id, tenantId)).returning();
    
    res.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: "Validation failed", details: error.issues });
      return;
    }
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/tenants/:tenantId/members
router.get("/:tenantId/members", authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = req.params.tenantId as string;
    const [myMembership] = await db
      .select()
      .from(tenantUsers)
      .where(and(eq(tenantUsers.tenantId, tenantId), eq(tenantUsers.userId, req.user!.id)));
    if (!myMembership) {
      res.status(403).json({ error: "Access denied" });
      return;
    }
    
    const members = await db.select().from(tenantUsers).where(eq(tenantUsers.tenantId, tenantId));
    res.json(members);
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
