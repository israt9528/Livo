import { Router } from "express";
import { AuthController } from "./auth.controller.js";
import {
  registerSchema,
  loginSchema,
  refreshTokenSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from "./auth.validation.js";
import { authRateLimiter } from "../../middleware/reteLimiter.js";
import { validateRequest } from "../../middleware/validateRequest.js";
import { auth } from "../../middleware/auth.js";

const router = Router();

// Public Routes (Rate-limited)
router.post(
  "/register",
  authRateLimiter,
  validateRequest(registerSchema),
  AuthController.register,
);

router.post(
  "/login",
  authRateLimiter,
  validateRequest(loginSchema),
  AuthController.login,
);

router.post(
  "/refresh-token",
  validateRequest(refreshTokenSchema),
  AuthController.refreshToken,
);

// Password Recovery Endpoints
router.post(
  "/forgot-password",
  authRateLimiter,
  validateRequest(forgotPasswordSchema),
  AuthController.forgotPassword,
);

router.post(
  "/reset-password",
  authRateLimiter,
  validateRequest(resetPasswordSchema),
  AuthController.resetPassword,
);

// Authenticated Route
router.post("/logout", auth(), AuthController.logout);

export const authRoutes = router;
export default router;
