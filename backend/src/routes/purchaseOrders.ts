import { Router } from "express";
import { authenticate, requireTenant } from "../middleware/auth";
import * as ctrl from "../controllers/purchaseOrder";

const router = Router({ mergeParams: true });

router.get("/", authenticate, requireTenant(), ctrl.listPurchaseOrders);
router.get("/:orderId", authenticate, requireTenant(), ctrl.getPurchaseOrder);
router.post("/", authenticate, requireTenant("manager"), ctrl.createPurchaseOrder);
router.patch("/:orderId", authenticate, requireTenant("manager"), ctrl.updatePurchaseOrder);
router.delete("/:orderId", authenticate, requireTenant("manager"), ctrl.deletePurchaseOrder);

export default router;
