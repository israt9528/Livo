import { Router } from "express";
import { UnitController } from "./unit.controller.js";
import { createUnitSchema } from "./unit.validation.js";
import { UserRole } from "../../lib/prisma.js";
import { auth } from "../../middleware/auth.js";
import { validateRequest } from "../../middleware/validateRequest.js";

const router = Router();

router.post(
	"/",
	auth(UserRole.OWNER, UserRole.ADMIN),
	validateRequest(createUnitSchema),
	UnitController.createUnit,
);

export const unitRoutes = router;
export default router;
