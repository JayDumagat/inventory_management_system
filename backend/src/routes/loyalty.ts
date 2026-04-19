import { Router } from "express";
import { authenticate, requireTenant } from "../middleware/auth";
import { requireFeature } from "../middleware/entitlement";
import * as ctrl from "../controllers/loyalty";

const router = Router({ mergeParams: true });

router.get("/config", authenticate, requireTenant(), ctrl.getConfig);
router.patch("/config", authenticate, requireTenant("manager"), requireFeature("loyalty"), ctrl.updateConfig);
router.get("/top-customers", authenticate, requireTenant("manager"), ctrl.getTopCustomers);
router.post("/adjust", authenticate, requireTenant("manager"), ctrl.adjustPoints);
router.post("/preview-redemption", authenticate, requireTenant(), ctrl.previewRedemption);
router.get("/customers/:customerId", authenticate, requireTenant(), ctrl.getCustomerLoyalty);

export default router;
