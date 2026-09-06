import { Router } from "express";
import { UnitController } from "./unit.controller.js";
import { createUnitSchema } from "./unit.validation.js";
import { UserRole } from "../../lib/prisma.js";
import { auth } from "../../middleware/auth.js";
import { validateRequest } from "../../middleware/validateRequest.js";
import { uploadMultipleImages } from "../../middleware/upload.js";

const router = Router();

// Public discovery endpoint
router.get("/", UnitController.getAllUnits);

// Create Unit (JSON body with optional images array)
router.post(
  "/",
  auth(UserRole.OWNER, UserRole.ADMIN),
  validateRequest(createUnitSchema),
  UnitController.createUnit,
);

// Upload images via Postman multipart form-data
router.patch(
  "/:id/images",
  auth(UserRole.OWNER, UserRole.ADMIN),
  uploadMultipleImages,
  UnitController.uploadImages,
);

export const unitRoutes = router;
export default router;
