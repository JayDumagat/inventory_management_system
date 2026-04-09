import { Router, Request, Response } from "express";
import { db } from "../db";
import { auditLogs } from "../db/schema";
import { eq, desc } from "drizzle-orm";
import { authenticate, requireTenant } from "../middleware/auth";

const router = Router({ mergeParams: true });

router.get("/", authenticate, requireTenant(), async (req: Request, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const offset = (page - 1) * limit;
    
    const logs = await db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.tenantId, req.tenantContext!.tenantId))
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit)
      .offset(offset);
    
    res.json({ data: logs, page, limit });
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
