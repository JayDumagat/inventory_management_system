import { Router } from "express";
import { authenticate, requireTenant } from "../middleware/auth";
import * as ctrl from "../controllers/apiKey";

const router = Router({ mergeParams: true });

router.get("/", authenticate, requireTenant("admin"), ctrl.listApiKeys);
router.post("/", authenticate, requireTenant("admin"), ctrl.createApiKey);
router.delete("/:keyId", authenticate, requireTenant("admin"), ctrl.revokeApiKey);

export default router;
