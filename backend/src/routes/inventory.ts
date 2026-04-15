import { Router } from "express";
import { authenticate, requireTenant } from "../middleware/auth";
import * as ctrl from "../controllers/inventory";

const router = Router({ mergeParams: true });

router.get("/", authenticate, requireTenant(), ctrl.listInventory);
router.post("/adjust", authenticate, requireTenant("manager"), ctrl.adjustStock);
router.put("/set", authenticate, requireTenant("manager"), ctrl.setStock);
router.get("/movements", authenticate, requireTenant(), ctrl.listMovements);
router.post("/transfer", authenticate, requireTenant("manager"), ctrl.transferStock);
router.get("/barcode/:code", authenticate, requireTenant(), ctrl.lookupBarcode);

export default router;
