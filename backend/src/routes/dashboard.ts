import { Router } from "express";
import { authenticate, requireTenant } from "../middleware/auth";
import * as ctrl from "../controllers/dashboard";

const router = Router({ mergeParams: true });

router.get("/stats", authenticate, requireTenant(), ctrl.getStats);

export default router;
