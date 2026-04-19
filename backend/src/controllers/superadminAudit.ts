import { Request, Response } from "express";
import { db } from "../db";
import { auditLogs, users, tenants } from "../db/schema";
import { desc, and, gte, lte, eq, ilike } from "drizzle-orm";
import { handleControllerError } from "../utils/errors";

// ─── Superadmin: platform-wide audit log ─────────────────────────────────────
export async function superadminAuditLogs(req: Request, res: Response): Promise<void> {
  try {
    const page = parseInt(typeof req.query.page === "string" ? req.query.page : "1", 10);
    const perPage = Math.min(
      parseInt(typeof req.query.perPage === "string" ? req.query.perPage : "50", 10),
      200,
    );
    const offset = (page - 1) * perPage;

    const from = typeof req.query.from === "string" ? new Date(req.query.from) : undefined;
    const to = typeof req.query.to === "string" ? new Date(req.query.to) : undefined;
    const search = typeof req.query.search === "string" ? req.query.search : undefined;
    const tenantId = typeof req.query.tenantId === "string" ? req.query.tenantId : undefined;
    const resourceType = typeof req.query.resourceType === "string" ? req.query.resourceType : undefined;

    const conditions = [];
    if (from) conditions.push(gte(auditLogs.createdAt, from));
    if (to) conditions.push(lte(auditLogs.createdAt, to));
    if (tenantId) conditions.push(eq(auditLogs.tenantId, tenantId));
    if (resourceType) conditions.push(ilike(auditLogs.resourceType, `%${resourceType}%`));
    if (search) conditions.push(ilike(auditLogs.resourceType, `%${search}%`));

    const rows = await db
      .select({
        id: auditLogs.id,
        tenantId: auditLogs.tenantId,
        userId: auditLogs.userId,
        action: auditLogs.action,
        resourceType: auditLogs.resourceType,
        resourceId: auditLogs.resourceId,
        ipAddress: auditLogs.ipAddress,
        createdAt: auditLogs.createdAt,
        oldValues: auditLogs.oldValues,
        newValues: auditLogs.newValues,
        actorEmail: users.email,
        actorFirstName: users.firstName,
        actorLastName: users.lastName,
        tenantName: tenants.name,
      })
      .from(auditLogs)
      .leftJoin(users, eq(auditLogs.userId, users.id))
      .leftJoin(tenants, eq(auditLogs.tenantId, tenants.id))
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(auditLogs.createdAt))
      .limit(perPage)
      .offset(offset);

    res.json({ logs: rows, page, perPage });
  } catch (error) {
    handleControllerError(error, res);
  }
}
