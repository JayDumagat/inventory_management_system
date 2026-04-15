import { Router } from "express";
import { authenticate, requireTenant } from "../middleware/auth";
import * as ctrl from "../controllers/unit";

const router = Router({ mergeParams: true });

router.get("/", authenticate, requireTenant(), ctrl.listUnits);
router.post("/", authenticate, requireTenant("manager"), ctrl.createUnit);
router.patch("/:unitId", authenticate, requireTenant("manager"), ctrl.updateUnit);
router.delete("/:unitId", authenticate, requireTenant("manager"), ctrl.deleteUnit);

export default router;
