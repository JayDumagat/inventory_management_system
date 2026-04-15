import { db } from "../db";
import { auditLogs } from "../db/schema";

export const createAuditLog = async (params: {
  tenantId?: string;
  userId?: string;
  action: "create" | "update" | "delete" | "login" | "logout" | "other";
  resourceType: string;
  resourceId?: string;
  oldValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}) => {
  try {
    await db.insert(auditLogs).values(params);
  } catch (error) {
    console.error("Failed to create audit log:", error);
  }
};
