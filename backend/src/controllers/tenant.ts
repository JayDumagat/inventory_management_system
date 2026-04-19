import { Request, Response } from "express";
import { db } from "../db";
import { tenants, tenantUsers, branches, tenantSubscriptions } from "../db/schema";
import { eq, and } from "drizzle-orm";
import { createAuditLog } from "../services/audit";
import { handleControllerError } from "../utils/errors";
import { createTenantSchema, updateTenantSchema } from "../validators/tenant";

export async function listTenants(req: Request, res: Response): Promise<void> {
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
        allowedPages: tenantUsers.allowedPages,
      })
      .from(tenantUsers)
      .innerJoin(tenants, eq(tenantUsers.tenantId, tenants.id))
      .where(and(eq(tenantUsers.userId, req.user!.id), eq(tenantUsers.isActive, true)));

    res.json(userTenants);
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function createTenant(req: Request, res: Response): Promise<void> {
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
    handleControllerError(error, res);
  }
}

export async function getTenant(req: Request, res: Response): Promise<void> {
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
}

export async function updateTenant(req: Request, res: Response): Promise<void> {
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

    const wantsBrandingChange = body.name !== undefined || body.logoUrl !== undefined;
    if (wantsBrandingChange) {
      const [sub] = await db
        .select({ planKey: tenantSubscriptions.planKey })
        .from(tenantSubscriptions)
        .where(eq(tenantSubscriptions.tenantId, tenantId));
      const [tenantPlan] = await db
        .select({ plan: tenants.plan })
        .from(tenants)
        .where(eq(tenants.id, tenantId));
      const planKey = sub?.planKey ?? tenantPlan?.plan;
      if (planKey !== "enterprise") {
        res.status(402).json({
          error: "Updating organization name and logo requires the Enterprise plan",
          requiredPlan: "enterprise",
          currentPlan: planKey ?? "free",
        });
        return;
      }
    }

    const [updated] = await db.update(tenants).set({ ...body, updatedAt: new Date() }).where(eq(tenants.id, tenantId)).returning();

    res.json(updated);
  } catch (error) {
    handleControllerError(error, res);
  }
}

export async function listMembers(req: Request, res: Response): Promise<void> {
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
}
