import { Router } from "express";
import { authenticate, requireTenant } from "../middleware/auth";
import * as ctrl from "../controllers/customer";

const router = Router({ mergeParams: true });

router.get("/", authenticate, requireTenant(), ctrl.listCustomers);
router.get("/search", authenticate, requireTenant(), ctrl.searchCustomers);
router.get("/:customerId", authenticate, requireTenant(), ctrl.getCustomer);
router.post("/", authenticate, requireTenant("staff"), ctrl.createCustomer);
router.patch("/:customerId", authenticate, requireTenant("staff"), ctrl.updateCustomer);
router.delete("/:customerId", authenticate, requireTenant("manager"), ctrl.deleteCustomer);

export default router;
