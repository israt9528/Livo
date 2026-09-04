import { Router } from "express";
import { ViewingController } from "./viewing.controller.js";
import {
  createViewingRequestSchema,
  updateViewingStatusSchema,
} from "./viewing.validation.js";
import { UserRole } from "../../lib/prisma.js";
import { auth } from "../../middleware/auth.js";
import { validateRequest } from "../../middleware/validateRequest.js";

const router = Router();

// Tenant creates viewing request
router.post(
  "/",
  auth(UserRole.TENANT),
  validateRequest(createViewingRequestSchema),
  ViewingController.createViewingRequest,
);

// All authenticated roles view their respective requests (Tenant, Owner, Admin)
router.get("/", auth(), ViewingController.getViewingRequests);

// Status transition (Owner confirms/rejects; Tenant can cancel)
router.patch(
  "/:id/status",
  auth(),
  validateRequest(updateViewingStatusSchema),
  ViewingController.updateViewingStatus,
);

export const viewingRoutes = router;
export default router;
