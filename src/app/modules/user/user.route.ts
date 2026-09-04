import { Router } from "express";
import { updateProfileSchema } from "./user.validation.js";
import { auth } from "../../middleware/auth.js";
import { validateRequest } from "../../middleware/validateRequest.js";
import { UserController } from "./user.controller.js";

const router = Router();

// Retrieve authenticated user profile
router.get("/me", auth(), UserController.getMe);

// Update authenticated user profile
router.patch(
  "/me",
  auth(),
  validateRequest(updateProfileSchema),
  UserController.updateMe,
);

export const userRoutes = router;
