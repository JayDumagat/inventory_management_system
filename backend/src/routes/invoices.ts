import { Router } from "express";
import { authenticate, requireTenant } from "../middleware/auth";
import * as ctrl from "../controllers/invoice";

const router = Router({ mergeParams: true });

router.get("/", authenticate, requireTenant(), ctrl.listInvoices);
router.get("/:invoiceId", authenticate, requireTenant(), ctrl.getInvoice);
router.post("/", authenticate, requireTenant("manager"), ctrl.createInvoice);
router.post("/from-order/:orderId", authenticate, requireTenant("manager"), ctrl.createInvoiceFromOrder);
router.patch("/:invoiceId", authenticate, requireTenant("manager"), ctrl.updateInvoice);
router.delete("/:invoiceId", authenticate, requireTenant("manager"), ctrl.deleteInvoice);

export default router;
