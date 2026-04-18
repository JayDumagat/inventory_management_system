import { v4 as uuidv4 } from "uuid";

const MIME_TO_EXTENSION: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "application/pdf": "pdf",
  "text/csv": "csv",
  "application/vnd.ms-excel": "xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
};

function sanitizeExtension(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const ext = value.trim().toLowerCase().replace(/^\.+/, "");
  if (!/^[a-z0-9]{1,10}$/.test(ext)) return undefined;
  return ext;
}

export function deriveObjectExtension(filename: string, mimeType: string): string {
  const fromFilename = sanitizeExtension(filename.includes(".") ? filename.split(".").pop() : undefined);
  if (fromFilename) return fromFilename;

  const fromMime = sanitizeExtension(MIME_TO_EXTENSION[mimeType]);
  if (fromMime) return fromMime;

  return "bin";
}

export function buildTenantObjectName(tenantId: string, filename: string, mimeType: string): string {
  const ext = deriveObjectExtension(filename, mimeType);
  return `${tenantId}-${uuidv4()}.${ext}`;
}

export function isTenantOwnedObjectName(objectName: string, tenantId: string): boolean {
  return objectName.startsWith(`${tenantId}-`) || objectName.startsWith(`${tenantId}/`);
}
