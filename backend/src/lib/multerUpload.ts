import multer from "multer";
import { ALLOWED_MIME_TYPES, MAX_SIZE_BYTES } from "../validators/upload";

const ALLOWED_TYPES_LABEL = "JPEG, PNG, WebP, GIF, PDF, CSV, XLS, XLSX";

export const fileUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_SIZE_BYTES },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type. Allowed types: ${ALLOWED_TYPES_LABEL}`));
    }
  },
});
