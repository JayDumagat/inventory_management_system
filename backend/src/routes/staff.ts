import { Router } from "express";
import { authenticate, requireTenant } from "../middleware/auth";
import * as ctrl from "../controllers/staff";

const router = Router({ mergeParams: true });

router.get("/", authenticate, requireTenant("manager"), ctrl.listStaff);
router.post("/", authenticate, requireTenant("admin"), ctrl.inviteStaff);
router.patch("/:staffId", authenticate, requireTenant("admin"), ctrl.updateStaff);
router.delete("/:staffId", authenticate, requireTenant("admin"), ctrl.deleteStaff);
router.get("/:staffId/branches", authenticate, requireTenant("manager"), ctrl.listStaffBranches);
router.post("/:staffId/branches", authenticate, requireTenant("manager"), ctrl.assignStaffBranch);
router.delete("/:staffId/branches/:branchId", authenticate, requireTenant("manager"), ctrl.removeStaffBranch);

export default router;
