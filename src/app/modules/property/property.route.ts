import { Router } from "express";
import {
	createPropertySchema,
	updatePropertySchema,
} from "./property.validation.js";
import { PropertyController } from "./property.controller.js";
import { UserRole } from "../../lib/prisma.js";
import { auth } from "../../middleware/auth.js";
import { validateRequest } from "../../middleware/validateRequest.js";

const router = Router();

// Public discovery endpoints
router.get("/", PropertyController.getProperties);
router.get("/:id", PropertyController.getPropertyById);

// Owner & Admin management endpoints
router.post(
	"/",
	auth(UserRole.OWNER, UserRole.ADMIN),
	validateRequest(createPropertySchema),
	PropertyController.createProperty,
);

router.patch(
	"/:id",
	auth(UserRole.OWNER, UserRole.ADMIN),
	validateRequest(updatePropertySchema),
	PropertyController.updateProperty,
);

router.delete(
	"/:id",
	auth(UserRole.OWNER, UserRole.ADMIN),
	PropertyController.deleteProperty,
);

export const propertyRoutes = router;
export default router;
