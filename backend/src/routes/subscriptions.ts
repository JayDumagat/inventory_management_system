import { Router } from "express";
import { authenticate, requireTenant } from "../middleware/auth";
import * as ctrl from "../controllers/subscription";

const router = Router({ mergeParams: true });

// Public plan listing (no auth required)
router.get("/plans", ctrl.listPlans);

// Tenant-scoped subscription routes
router.get("/", authenticate, requireTenant(), ctrl.getSubscription);
router.patch("/", authenticate, requireTenant("admin"), ctrl.changePlan);
router.get("/history", authenticate, requireTenant("admin"), ctrl.getHistory);
router.post("/addons", authenticate, requireTenant("admin"), ctrl.addAddon);
router.delete("/addons", authenticate, requireTenant("admin"), ctrl.removeAddon);

export default router;
