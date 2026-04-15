import { Router } from "express";
import { authenticate, requireTenant } from "../middleware/auth";
import * as ctrl from "../controllers/auditLog";

const router = Router({ mergeParams: true });

router.get("/", authenticate, requireTenant(), ctrl.listAuditLogs);

export default router;
