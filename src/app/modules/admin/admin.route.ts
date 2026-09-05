import { Router } from "express";
import { AdminController } from "./admin.controller.js";
import {
  updateUserRoleSchema,
  updateUserStatusSchema,
} from "./admin.validation.js";
import { auth } from "../../middleware/auth.js";
import { UserRole } from "../../lib/prisma.js";
import { validateRequest } from "../../middleware/validateRequest.js";

const router = Router();

// All endpoints in this router are restricted strictly to ADMIN
router.use(auth(UserRole.ADMIN));

// Search and list all system users
router.get("/users", AdminController.getUsers);

// Account status management (Suspend / Activate / Deactivate)
router.patch(
  "/users/:id/status",
  validateRequest(updateUserStatusSchema),
  AdminController.updateUserStatus,
);

// Role escalation and demotion
router.patch(
  "/users/:id/role",
  validateRequest(updateUserRoleSchema),
  AdminController.updateUserRole,
);

export const adminRoutes = router;
export default router;
