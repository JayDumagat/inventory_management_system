import { Router } from "express";
import * as ctrl from "../controllers/auth";
import { authLimiter } from "../config/rateLimiter";

const router = Router();

// Apply strict rate limiting to brute-force-prone endpoints (DICT cybersecurity)
router.post("/register", authLimiter, ctrl.register);
router.post("/login", authLimiter, ctrl.login);
router.post("/forgot-password", authLimiter, ctrl.forgotPassword);
router.post("/reset-password", authLimiter, ctrl.resetPassword);
router.post("/refresh", ctrl.refresh);
router.get("/me", ctrl.me);
router.post("/oauth/google", authLimiter, ctrl.googleOAuth);
router.get("/invite-info", ctrl.inviteInfo);
router.post("/complete-invite", authLimiter, ctrl.completeInvite);

export default router;
