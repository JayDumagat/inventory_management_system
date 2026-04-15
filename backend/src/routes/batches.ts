import { Router } from "express";
import { authenticate, requireTenant } from "../middleware/auth";
import * as ctrl from "../controllers/batch";

const router = Router({ mergeParams: true });

router.get("/", authenticate, requireTenant(), ctrl.listBatches);
router.post("/", authenticate, requireTenant("manager"), ctrl.createBatch);
router.patch("/:batchId", authenticate, requireTenant("manager"), ctrl.updateBatch);
router.delete("/:batchId", authenticate, requireTenant("manager"), ctrl.deleteBatch);

export default router;
