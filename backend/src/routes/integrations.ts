import { Router } from "express";
import { authenticate, requireTenant } from "../middleware/auth";
import * as ctrl from "../controllers/integration";

const router = Router({ mergeParams: true });

router.get("/", authenticate, requireTenant(), ctrl.listIntegrations);
router.put("/:provider", authenticate, requireTenant("admin"), ctrl.upsertIntegration);

export default router;
