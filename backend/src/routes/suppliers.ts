import { Router } from "express";
import { authenticate, requireTenant } from "../middleware/auth";
import * as ctrl from "../controllers/supplier";

const router = Router({ mergeParams: true });

router.get("/", authenticate, requireTenant(), ctrl.listSuppliers);
router.get("/:supplierId", authenticate, requireTenant(), ctrl.getSupplier);
router.post("/", authenticate, requireTenant("manager"), ctrl.createSupplier);
router.patch("/:supplierId", authenticate, requireTenant("manager"), ctrl.updateSupplier);
router.delete("/:supplierId", authenticate, requireTenant("manager"), ctrl.deleteSupplier);

export default router;
