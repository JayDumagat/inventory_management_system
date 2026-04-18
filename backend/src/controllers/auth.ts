import { Request, Response } from "express";
import argon2 from "argon2";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { db } from "../db";
import { users, tenants, tenantUsers } from "../db/schema";
import { eq, and, gt } from "drizzle-orm";
import { createAuditLog } from "../services/audit";
import { generateTokens } from "../services/auth";
import { handleControllerError } from "../utils/errors";
import {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  googleOAuthSchema,
} from "../validators/auth";

export async function register(req: Request, res: Response): Promise<void> {
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
    handleControllerError(error, res);
  }
}

export async function login(req: Request, res: Response): Promise<void> {
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
    handleControllerError(error, res);
  }
}

export async function refresh(req: Request, res: Response): Promise<void> {
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
}

export async function me(req: Request, res: Response): Promise<void> {
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
}

export async function forgotPassword(req: Request, res: Response): Promise<void> {
  try {
    const { email } = forgotPasswordSchema.parse(req.body);

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
    handleControllerError(error, res);
  }
}

export async function resetPassword(req: Request, res: Response): Promise<void> {
  try {
    const body = resetPasswordSchema.parse(req.body);

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
    handleControllerError(error, res);
  }
}

export async function googleOAuth(req: Request, res: Response): Promise<void> {
  try {
    const { credential } = googleOAuthSchema.parse(req.body);

    // Decode the Google JWT (header.payload.signature)
    const parts = credential.split(".");
    if (parts.length !== 3) {
      res.status(400).json({ error: "Invalid Google credential" });
      return;
    }

    let header: { kid?: string; alg?: string };
    let payload: { sub: string; email: string; email_verified?: boolean; given_name?: string; family_name?: string; aud: string | string[]; iss: string; exp: number };
    try {
      header = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf-8"));
      payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf-8"));
    } catch {
      res.status(400).json({ error: "Invalid Google credential format" });
      return;
    }

    // Validate basic claims before fetching public keys
    const expectedAud = process.env.GOOGLE_CLIENT_ID;
    const audList = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
    if (expectedAud && !audList.includes(expectedAud)) {
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

    // Verify JWT signature using Google's public keys
    if (expectedAud) {
      try {
        const jwksRes = await fetch("https://www.googleapis.com/oauth2/v3/certs");
        const jwks = await jwksRes.json() as { keys: Array<{ kid: string; n: string; e: string; alg: string; use: string }> };
        const key = jwks.keys.find((k) => k.kid === header.kid);
        if (!key) {
          res.status(400).json({ error: "Google public key not found" });
          return;
        }
        const { createPublicKey, createVerify } = await import("crypto");
        const pubKey = createPublicKey({ key: { kty: "RSA", n: key.n, e: key.e }, format: "jwk" });
        const signingInput = `${parts[0]}.${parts[1]}`;
        const signature = Buffer.from(parts[2], "base64url");
        const verify = createVerify("RSA-SHA256");
        verify.update(signingInput);
        if (!verify.verify(pubKey, signature)) {
          res.status(400).json({ error: "Google credential signature invalid" });
          return;
        }
      } catch (verifyErr) {
        console.error("Google JWT verification error:", verifyErr);
        res.status(400).json({ error: "Could not verify Google credential" });
        return;
      }
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
    handleControllerError(error, res);
  }
}

export async function inviteInfo(req: Request, res: Response): Promise<void> {
  try {
    const token = typeof req.query.token === "string" ? req.query.token : undefined;
    if (!token) {
      res.status(400).json({ error: "Token required" });
      return;
    }

    let payload: { userId: string; tenantId: string; type: string };
    try {
      payload = jwt.verify(token, process.env.JWT_SECRET!) as typeof payload;
    } catch {
      res.status(400).json({ error: "Invalid or expired invite link" });
      return;
    }

    if (payload.type !== "staff-invite") {
      res.status(400).json({ error: "Invalid invite token" });
      return;
    }

    const [user] = await db
      .select({ id: users.id, email: users.email, firstName: users.firstName, lastName: users.lastName })
      .from(users)
      .where(eq(users.id, payload.userId));

    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const [tenantRecord] = await db
      .select({ name: tenants.name })
      .from(tenants)
      .where(eq(tenants.id, payload.tenantId));

    res.json({
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      tenantName: tenantRecord?.name ?? "",
    });
  } catch (error) {
    handleControllerError(error, res);
  }
}

export async function completeInvite(req: Request, res: Response): Promise<void> {
  try {
    const { inviteToken, password, firstName, lastName } = req.body as {
      inviteToken: string;
      password: string;
      firstName?: string;
      lastName?: string;
    };

    if (!inviteToken || !password) {
      res.status(400).json({ error: "inviteToken and password are required" });
      return;
    }

    if (password.length < 8) {
      res.status(400).json({ error: "Password must be at least 8 characters" });
      return;
    }

    let payload: { userId: string; tenantId: string; type: string };
    try {
      payload = jwt.verify(inviteToken, process.env.JWT_SECRET!) as typeof payload;
    } catch {
      res.status(400).json({ error: "Invalid or expired invite link" });
      return;
    }

    if (payload.type !== "staff-invite") {
      res.status(400).json({ error: "Invalid invite token" });
      return;
    }

    const [user] = await db.select().from(users).where(eq(users.id, payload.userId));
    if (!user || !user.isActive) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const [tenantUser] = await db
      .select()
      .from(tenantUsers)
      .where(and(eq(tenantUsers.tenantId, payload.tenantId), eq(tenantUsers.userId, user.id), eq(tenantUsers.isActive, true)));

    if (!tenantUser) {
      res.status(403).json({ error: "Invitation is no longer valid" });
      return;
    }

    const passwordHash = await argon2.hash(password);

    const [updatedUser] = await db
      .update(users)
      .set({
        passwordHash,
        firstName: firstName || user.firstName,
        lastName: lastName || user.lastName,
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id))
      .returning();

    const { accessToken, refreshToken } = generateTokens(updatedUser.id, updatedUser.email);

    await createAuditLog({
      tenantId: payload.tenantId,
      userId: updatedUser.id,
      action: "login",
      resourceType: "user",
      resourceId: updatedUser.id,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });

    res.json({
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        firstName: updatedUser.firstName,
        lastName: updatedUser.lastName,
      },
      accessToken,
      refreshToken,
    });
  } catch (error) {
    handleControllerError(error, res);
  }
}
