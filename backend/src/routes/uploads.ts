import { Router, Request, Response, NextFunction } from "express";
import multer from "multer";
import { authenticate, requireTenant } from "../middleware/auth";
import { fileUpload } from "../lib/multerUpload";
import * as ctrl from "../controllers/upload";

const router = Router({ mergeParams: true });

// Wrap Multer so that size / type errors are returned as structured JSON
// instead of bubbling up as unhandled Express errors.
function multerMiddleware(req: Request, res: Response, next: NextFunction): void {
  fileUpload.single("file")(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        res.status(400).json({ error: "File exceeds 10 MB limit" });
        return;
      }
      res.status(400).json({ error: err.message });
      return;
    }
    if (err instanceof Error) {
      res.status(400).json({ error: err.message });
      return;
    }
    next();
  });
}

router.post("/", authenticate, requireTenant("manager"), multerMiddleware, ctrl.uploadFileHandler);
router.get("/presign", authenticate, requireTenant(), ctrl.getPresignedUrlHandler);
router.post("/presign-batch", authenticate, requireTenant(), ctrl.batchPresignedUrlHandler);
router.delete("/", authenticate, requireTenant("manager"), ctrl.deleteFileHandler);

export default router;
