import { Router } from "express";
import { AuthController } from "./auth.controller.js";
import {
  registerSchema,
  loginSchema,
  refreshTokenSchema,
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

// Authenticated Route
router.post(
  "/logout",
  auth(), // Requires any authenticated role
  AuthController.logout,
);

export const authRoutes = router;
