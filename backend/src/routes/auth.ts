import { Router } from "express";
import * as ctrl from "../controllers/auth";

const router = Router();

router.post("/register", ctrl.register);
router.post("/login", ctrl.login);
router.post("/refresh", ctrl.refresh);
router.get("/me", ctrl.me);
router.post("/forgot-password", ctrl.forgotPassword);
router.post("/reset-password", ctrl.resetPassword);
router.post("/oauth/google", ctrl.googleOAuth);

export default router;
