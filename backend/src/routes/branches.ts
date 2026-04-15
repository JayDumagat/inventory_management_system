import { Router } from "express";
import { authenticate, requireTenant } from "../middleware/auth";
import * as ctrl from "../controllers/branch";

const router = Router({ mergeParams: true });

router.get("/", authenticate, requireTenant(), ctrl.listBranches);
router.post("/", authenticate, requireTenant("manager"), ctrl.createBranch);
router.get("/:branchId", authenticate, requireTenant(), ctrl.getBranch);
router.patch("/:branchId", authenticate, requireTenant("manager"), ctrl.updateBranch);
router.delete("/:branchId", authenticate, requireTenant("admin"), ctrl.deleteBranch);

export default router;
