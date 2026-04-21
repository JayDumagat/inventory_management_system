import { Router } from "express";
import { authenticate, requireTenant } from "../middleware/auth";
import { requireFeature } from "../middleware/entitlement";
import * as ctrl from "../controllers/loyalty";

const router = Router({ mergeParams: true });

router.get("/config", authenticate, requireTenant(), requireFeature("loyalty"), ctrl.getConfig);
router.patch("/config", authenticate, requireTenant("manager"), requireFeature("loyalty"), ctrl.updateConfig);
router.get("/top-customers", authenticate, requireTenant("manager"), requireFeature("loyalty"), ctrl.getTopCustomers);
router.post("/adjust", authenticate, requireTenant("manager"), requireFeature("loyalty"), ctrl.adjustPoints);
router.post("/preview-redemption", authenticate, requireTenant(), requireFeature("loyalty"), ctrl.previewRedemption);
router.get("/customers/:customerId", authenticate, requireTenant(), requireFeature("loyalty"), ctrl.getCustomerLoyalty);

export default router;
