import { Router } from "express";
import { authenticate, requireTenant } from "../middleware/auth";
import * as ctrl from "../controllers/transaction";

const router = Router({ mergeParams: true });

router.get("/", authenticate, requireTenant(), ctrl.listTransactions);
router.post("/", authenticate, requireTenant("manager"), ctrl.createTransaction);
router.delete("/:transactionId", authenticate, requireTenant("manager"), ctrl.deleteTransaction);

export default router;
