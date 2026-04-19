import { Router } from "express";
import { authenticate, requireTenant } from "../middleware/auth";
import { requireQuota } from "../middleware/entitlement";
import * as ctrl from "../controllers/product";

const router = Router({ mergeParams: true });

router.get("/", authenticate, requireTenant(), ctrl.listProducts);
router.post("/", authenticate, requireTenant("manager"), requireQuota("products"), ctrl.createProduct);
router.get("/:productId", authenticate, requireTenant(), ctrl.getProduct);
router.patch("/:productId", authenticate, requireTenant("manager"), ctrl.updateProduct);
router.delete("/:productId", authenticate, requireTenant("manager"), ctrl.deleteProduct);

router.get("/:productId/variants", authenticate, requireTenant(), ctrl.listVariants);
router.post("/:productId/variants", authenticate, requireTenant("manager"), ctrl.createVariant);
router.patch("/:productId/variants/:variantId", authenticate, requireTenant("manager"), ctrl.updateVariant);
router.delete("/:productId/variants/:variantId", authenticate, requireTenant("manager"), ctrl.deleteVariant);

router.get("/:productId/attributes", authenticate, requireTenant(), ctrl.listAttributes);
router.post("/:productId/attributes", authenticate, requireTenant("manager"), ctrl.createAttribute);
router.patch("/:productId/attributes/:attributeId", authenticate, requireTenant("manager"), ctrl.updateAttribute);
router.delete("/:productId/attributes/:attributeId", authenticate, requireTenant("manager"), ctrl.deleteAttribute);
router.post("/:productId/attributes/:attributeId/options", authenticate, requireTenant("manager"), ctrl.createAttributeOption);
router.delete("/:productId/attributes/:attributeId/options/:optionId", authenticate, requireTenant("manager"), ctrl.deleteAttributeOption);

router.get("/:productId/images", authenticate, requireTenant(), ctrl.listProductImages);
router.post("/:productId/images", authenticate, requireTenant("manager"), ctrl.addProductImage);
router.delete("/:productId/images/:imageId", authenticate, requireTenant("manager"), ctrl.deleteProductImage);

export default router;
