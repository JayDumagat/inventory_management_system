import { Router } from "express";
import { authenticate, requireTenant } from "../middleware/auth";
import { requireFeature } from "../middleware/entitlement";
import * as ctrl from "../controllers/promotion";

const router = Router({ mergeParams: true });

router.get("/", authenticate, requireTenant(), ctrl.listPromotions);
router.post("/", authenticate, requireTenant("manager"), requireFeature("promotions"), ctrl.createPromotion);
router.get("/auto", authenticate, requireTenant(), ctrl.getAutoPromotions);
router.post("/apply", authenticate, requireTenant(), ctrl.applyPromotion);
router.get("/:promotionId", authenticate, requireTenant(), ctrl.getPromotion);
router.patch("/:promotionId", authenticate, requireTenant("manager"), requireFeature("promotions"), ctrl.updatePromotion);
router.delete("/:promotionId", authenticate, requireTenant("manager"), requireFeature("promotions"), ctrl.deletePromotion);
router.get("/:promotionId/usage", authenticate, requireTenant("manager"), ctrl.getPromotionUsage);

export default router;
