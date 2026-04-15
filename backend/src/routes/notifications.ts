import { Router } from "express";
import { authenticate, requireTenant } from "../middleware/auth";
import * as ctrl from "../controllers/notification";

const router = Router({ mergeParams: true });

router.get("/", authenticate, requireTenant(), ctrl.listNotifications);

export default router;
