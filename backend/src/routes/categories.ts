import { Router } from "express";
import { authenticate, requireTenant } from "../middleware/auth";
import * as ctrl from "../controllers/category";

const router = Router({ mergeParams: true });

router.get("/", authenticate, requireTenant(), ctrl.listCategories);
router.post("/", authenticate, requireTenant("manager"), ctrl.createCategory);
router.get("/:categoryId", authenticate, requireTenant(), ctrl.getCategory);
router.patch("/:categoryId", authenticate, requireTenant("manager"), ctrl.updateCategory);
router.delete("/:categoryId", authenticate, requireTenant("manager"), ctrl.deleteCategory);

export default router;
