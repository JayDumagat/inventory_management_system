import { Router } from "express";
import { authenticate, requireTenant } from "../middleware/auth";
import * as ctrl from "../controllers/report";

const router = Router({ mergeParams: true });

router.get("/sales", authenticate, requireTenant(), ctrl.salesReport);
router.get("/inventory", authenticate, requireTenant(), ctrl.inventoryReport);
router.get("/products", authenticate, requireTenant(), ctrl.productsReport);

export default router;
