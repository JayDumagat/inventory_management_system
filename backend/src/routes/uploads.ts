import { Router } from "express";
import { authenticate, requireTenant } from "../middleware/auth";
import * as ctrl from "../controllers/upload";

const router = Router({ mergeParams: true });

router.post("/", authenticate, requireTenant("manager"), ctrl.uploadFileHandler);
router.get("/presign", authenticate, requireTenant(), ctrl.getPresignedUrlHandler);
router.delete("/", authenticate, requireTenant("manager"), ctrl.deleteFileHandler);

export default router;
