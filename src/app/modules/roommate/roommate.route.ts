import { Router } from "express";
import { UserRole } from "../../../generated/prisma/client";
import { RoommateController } from "../roommate/roommate.controller.js";
import { upsertPreferenceSchema } from "../roommate/roommate.validation.js";
import { auth } from "../../middleware/auth";
import { validateRequest } from "../../middleware/validateRequest";

const router = Router();

// Roommate Matchmaking endpoints (Restricted strictly to TENANT)
router.put(
	"/roommate-preference",
	auth(UserRole.TENANT),
	validateRequest(upsertPreferenceSchema),
	RoommateController.upsertPreference,
);

router.get(
	"/roommate-matches",
	auth(UserRole.TENANT),
	RoommateController.getMatches,
);

export const roommateRoutes = router;
