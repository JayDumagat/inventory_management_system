import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { db } from "../db";
import { superadminUsers } from "../db/schema";
import { eq } from "drizzle-orm";

export interface SuperadminContext {
  id: string;
  email: string;
  role: string;
  allowedPages: string[];
}

/** Verify superadmin JWT and attach superadmin context to the request. */
export const requireSuperadmin = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      res.status(401).json({ error: "No token provided" });
      return;
    }

    const token = authHeader.split(" ")[1];
    let decoded: { superadminId: string; email: string };
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET!) as typeof decoded;
    } catch {
      res.status(401).json({ error: "Invalid token" });
      return;
    }

    if (!decoded.superadminId) {
      res.status(401).json({ error: "Not a superadmin token" });
      return;
    }

    const [sa] = await db
      .select()
      .from(superadminUsers)
      .where(eq(superadminUsers.id, decoded.superadminId));

    if (!sa || !sa.isActive) {
      res.status(401).json({ error: "Invalid or inactive superadmin account" });
      return;
    }

    req.superadmin = {
      id: sa.id,
      email: sa.email,
      role: sa.role,
      allowedPages: (sa.allowedPages as string[]) ?? [],
    };

    next();
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
};

/** Verify superadmin is the owner (platform_owner role). */
export const requireSuperadminOwner = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  await requireSuperadmin(req, res, () => {
    if (req.superadmin?.role !== "owner") {
      res.status(403).json({ error: "Only the platform owner can perform this action" });
      return;
    }
    next();
  });
};

/**
 * Factory: verify superadmin has access to a given page/section.
 * Owners always have access; staff must have the page in their allowedPages.
 */
export function requireSuperadminPage(page: string) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    await requireSuperadmin(req, res, () => {
      if (!req.superadmin) return;
      const { role, allowedPages } = req.superadmin;
      if (role === "owner") {
        next();
        return;
      }
      if (!allowedPages.includes(page)) {
        res.status(403).json({ error: "Access denied to this panel section" });
        return;
      }
      next();
    });
  };
}
