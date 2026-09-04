import { Router } from "express";
import { ApplicationController } from "./application.controller.js";
import {
  createApplicationSchema,
  updateApplicationStatusSchema,
} from "./application.validation.js";
import { UserRole } from "../../lib/prisma.js";
import { auth } from "../../middleware/auth.js";
import { validateRequest } from "../../middleware/validateRequest.js";

const router = Router();

// Tenant submits application
router.post(
  "/",
  auth(UserRole.TENANT),
  validateRequest(createApplicationSchema),
  ApplicationController.createApplication,
);

// All authenticated roles can list their relevant applications
router.get("/", auth(), ApplicationController.getApplications);

// Single application details
router.get("/:id", auth(), ApplicationController.getApplicationById);

// Status transition (Owner approves/rejects, Tenant cancels)
router.patch(
  "/:id/status",
  auth(),
  validateRequest(updateApplicationStatusSchema),
  ApplicationController.updateApplicationStatus,
);

export const applicationRoutes = router;
export default router;
