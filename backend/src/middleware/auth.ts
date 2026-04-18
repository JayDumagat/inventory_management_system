import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { db } from "../db";
import { users, tenantUsers } from "../db/schema";
import { eq, and } from "drizzle-orm";

export const authenticate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      res.status(401).json({ error: "No token provided" });
      return;
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string; email: string };

    const [user] = await db.select().from(users).where(eq(users.id, decoded.userId));
    if (!user || !user.isActive) {
      res.status(401).json({ error: "Invalid or inactive user" });
      return;
    }

    req.user = { id: user.id, email: user.email };
    next();
  } catch (error) {
    res.status(401).json({ error: "Invalid token" });
  }
};

export const requireTenant = (minRole?: string) => async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const tenantId = (req.headers["x-tenant-id"] as string) || (req.params.tenantId as string);
    if (!tenantId) {
      res.status(400).json({ error: "Tenant ID required" });
      return;
    }

    const [tenantUser] = await db
      .select()
      .from(tenantUsers)
      .where(and(eq(tenantUsers.tenantId, tenantId), eq(tenantUsers.userId, req.user!.id), eq(tenantUsers.isActive, true)));

    if (!tenantUser) {
      res.status(403).json({ error: "Access denied to this tenant" });
      return;
    }

    const roleHierarchy = ["staff", "manager", "admin", "owner"];
    if (minRole && roleHierarchy.indexOf(tenantUser.role) < roleHierarchy.indexOf(minRole)) {
      res.status(403).json({ error: "Insufficient permissions" });
      return;
    }

    req.tenantContext = { tenantId, role: tenantUser.role };
    next();
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
};
