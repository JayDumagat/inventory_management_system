import { Router } from "express";
import { authenticate } from "../middleware/auth";
import * as ctrl from "../controllers/tenant";

const router = Router();

router.get("/", authenticate, ctrl.listTenants);
router.post("/", authenticate, ctrl.createTenant);
router.get("/:tenantId", authenticate, ctrl.getTenant);
router.patch("/:tenantId", authenticate, ctrl.updateTenant);
router.get("/:tenantId/members", authenticate, ctrl.listMembers);

export default router;
