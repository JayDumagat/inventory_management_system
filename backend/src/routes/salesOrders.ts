import { Router } from "express";
import { authenticate, requireTenant } from "../middleware/auth";
import * as ctrl from "../controllers/salesOrder";

const router = Router({ mergeParams: true });

router.get("/", authenticate, requireTenant(), ctrl.listOrders);
router.post("/", authenticate, requireTenant("staff"), ctrl.createOrder);
router.get("/:orderId", authenticate, requireTenant(), ctrl.getOrder);
router.patch("/:orderId", authenticate, requireTenant("staff"), ctrl.updateOrder);
router.delete("/:orderId", authenticate, requireTenant("manager"), ctrl.deleteOrder);
router.post("/:orderId/refund", authenticate, requireTenant("manager"), ctrl.refundOrder);

export default router;
