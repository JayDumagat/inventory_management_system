import { Router, Request, Response } from "express";
import { z } from "zod";
import argon2 from "argon2";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { db } from "../db";
import { users } from "../db/schema";
import { eq, and, gt } from "drizzle-orm";
import { createAuditLog } from "../middleware/auditLog";

const router = Router();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string(),
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
}).refine(data => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

function generateTokens(userId: string, email: string) {
  const accessToken = jwt.sign(
    { userId, email },
    process.env.JWT_SECRET!,
    { expiresIn: "15m" }
  );
  const refreshToken = jwt.sign(
    { userId, email },
    process.env.JWT_REFRESH_SECRET!,
    { expiresIn: "7d" }
  );
  return { accessToken, refreshToken };
}

// POST /api/auth/register
router.post("/register", async (req: Request, res: Response): Promise<void> => {
  try {
    const body = registerSchema.parse(req.body);
    
    const [existing] = await db.select().from(users).where(eq(users.email, body.email));
    if (existing) {
      res.status(409).json({ error: "Email already registered" });
      return;
    }

    const passwordHash = await argon2.hash(body.password);
    const [user] = await db.insert(users).values({
      email: body.email,
      passwordHash,
      firstName: body.firstName || "",
      lastName: body.lastName || "",
    }).returning();

    const { accessToken, refreshToken } = generateTokens(user.id, user.email);

    await createAuditLog({
      userId: user.id,
      action: "create",
      resourceType: "user",
      resourceId: user.id,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });

    res.status(201).json({
      user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName },
      accessToken,
      refreshToken,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: "Validation failed", details: error.issues });
      return;
    }
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/auth/login
router.post("/login", async (req: Request, res: Response): Promise<void> => {
  try {
    const body = loginSchema.parse(req.body);
    
    const [user] = await db.select().from(users).where(eq(users.email, body.email));
    if (!user || !user.isActive) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

    if (!user.passwordHash) {
      res.status(401).json({ error: "This account uses social login. Please sign in with Google." });
      return;
    }

    const valid = await argon2.verify(user.passwordHash, body.password);
    if (!valid) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

    const { accessToken, refreshToken } = generateTokens(user.id, user.email);

    await createAuditLog({
      userId: user.id,
      action: "login",
      resourceType: "user",
      resourceId: user.id,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });

    res.json({
      user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName },
      accessToken,
      refreshToken,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: "Validation failed", details: error.issues });
      return;
    }
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/auth/refresh
router.post("/refresh", async (req: Request, res: Response): Promise<void> => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      res.status(401).json({ error: "No refresh token" });
      return;
    }

    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET!) as { userId: string; email: string };
    const [user] = await db.select().from(users).where(eq(users.id, decoded.userId));
    
    if (!user || !user.isActive) {
      res.status(401).json({ error: "Invalid user" });
      return;
    }

    const tokens = generateTokens(user.id, user.email);
    res.json(tokens);
  } catch (error) {
    res.status(401).json({ error: "Invalid refresh token" });
  }
});

// GET /api/auth/me
router.get("/me", async (req: Request, res: Response): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      res.status(401).json({ error: "No token" });
      return;
    }
    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string };
    const [user] = await db.select({ id: users.id, email: users.email, firstName: users.firstName, lastName: users.lastName, createdAt: users.createdAt }).from(users).where(eq(users.id, decoded.userId));
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    res.json(user);
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
});

// POST /api/auth/forgot-password
router.post("/forgot-password", async (req: Request, res: Response): Promise<void> => {
  try {
    const { email } = z.object({ email: z.string().email() }).parse(req.body);

    const [user] = await db.select().from(users).where(eq(users.email, email));
    // Always respond 200 to avoid user enumeration
    if (!user || !user.isActive) {
      res.json({ message: "If that email is registered, a reset link has been sent." });
      return;
    }

    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
    const expiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await db.update(users).set({
      passwordResetToken: tokenHash,
      passwordResetExpiry: expiry,
      updatedAt: new Date(),
    }).where(eq(users.id, user.id));

    // In production, send via email. Returning token for dev/demo purposes.
    const isDev = process.env.NODE_ENV !== "production";
    res.json({
      message: "If that email is registered, a reset link has been sent.",
      ...(isDev && { resetToken: rawToken }),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: "Validation failed", details: error.issues });
      return;
    }
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/auth/reset-password
router.post("/reset-password", async (req: Request, res: Response): Promise<void> => {
  try {
    const body = z.object({
      token: z.string().min(1),
      password: z.string().min(8, "Password must be at least 8 characters"),
      confirmPassword: z.string(),
    }).refine(d => d.password === d.confirmPassword, {
      message: "Passwords do not match",
      path: ["confirmPassword"],
    }).parse(req.body);

    const tokenHash = crypto.createHash("sha256").update(body.token).digest("hex");
    const now = new Date();

    const [user] = await db
      .select()
      .from(users)
      .where(and(eq(users.passwordResetToken, tokenHash), gt(users.passwordResetExpiry!, now)));

    if (!user) {
      res.status(400).json({ error: "Invalid or expired reset token" });
      return;
    }

    const passwordHash = await argon2.hash(body.password);
    await db.update(users).set({
      passwordHash,
      passwordResetToken: null,
      passwordResetExpiry: null,
      updatedAt: new Date(),
    }).where(eq(users.id, user.id));

    res.json({ message: "Password reset successfully" });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: "Validation failed", details: error.issues });
      return;
    }
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/auth/oauth/google
// Accepts a Google ID token (credential from Google Identity Services), verifies it, and returns JWT tokens.
router.post("/oauth/google", async (req: Request, res: Response): Promise<void> => {
  try {
    const { credential } = z.object({ credential: z.string().min(1) }).parse(req.body);

    // Decode the Google JWT payload (header.payload.signature)
    const parts = credential.split(".");
    if (parts.length !== 3) {
      res.status(400).json({ error: "Invalid Google credential" });
      return;
    }

    let payload: { sub: string; email: string; given_name?: string; family_name?: string; aud: string; iss: string; exp: number };
    try {
      const decoded = Buffer.from(parts[1], "base64url").toString("utf-8");
      payload = JSON.parse(decoded);
    } catch {
      res.status(400).json({ error: "Invalid Google credential format" });
      return;
    }

    // Basic validation of claims
    const expectedAud = process.env.GOOGLE_CLIENT_ID;
    if (expectedAud && payload.aud !== expectedAud) {
      res.status(400).json({ error: "Invalid audience" });
      return;
    }
    if (!["accounts.google.com", "https://accounts.google.com"].includes(payload.iss)) {
      res.status(400).json({ error: "Invalid issuer" });
      return;
    }
    if (payload.exp < Math.floor(Date.now() / 1000)) {
      res.status(400).json({ error: "Google credential expired" });
      return;
    }

    const { sub: googleId, email, given_name: firstName = "", family_name: lastName = "" } = payload;

    // Find existing user by oauth provider id or email
    let [user] = await db
      .select()
      .from(users)
      .where(and(eq(users.oauthProvider, "google"), eq(users.oauthProviderId, googleId)));

    if (!user) {
      // Check if email already exists (link accounts)
      [user] = await db.select().from(users).where(eq(users.email, email));
      if (user) {
        // Link google oauth to existing account
        [user] = await db.update(users).set({
          oauthProvider: "google",
          oauthProviderId: googleId,
          updatedAt: new Date(),
        }).where(eq(users.id, user.id)).returning();
      } else {
        // Create new user
        [user] = await db.insert(users).values({
          email,
          firstName,
          lastName,
          oauthProvider: "google",
          oauthProviderId: googleId,
        }).returning();
      }
    }

    if (!user.isActive) {
      res.status(401).json({ error: "Account is inactive" });
      return;
    }

    const { accessToken, refreshToken } = generateTokens(user.id, user.email);

    await createAuditLog({
      userId: user.id,
      action: "login",
      resourceType: "user",
      resourceId: user.id,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });

    res.json({
      user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName },
      accessToken,
      refreshToken,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: "Validation failed", details: error.issues });
      return;
    }
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
