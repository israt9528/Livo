import { Router } from "express";
import { updateProfileSchema } from "./user.validation.js";
import { auth } from "../../middleware/auth.js";
import { validateRequest } from "../../middleware/validateRequest.js";
import { uploadSingleImage } from "../../middleware/upload.js";
import { UserController } from "./user.controller.js";

const router = Router();

// Retrieve authenticated user profile
router.get("/me", auth(), UserController.getMe);

// Update user profile fields (name, bio, phoneNumber)
router.patch(
  "/me",
  auth(),
  validateRequest(updateProfileSchema),
  UserController.updateMe,
);

// Upload or replace user avatar image
router.patch(
  "/me/avatar",
  auth(),
  uploadSingleImage,
  UserController.uploadAvatar,
);

export const userRoutes = router;
export default router;
