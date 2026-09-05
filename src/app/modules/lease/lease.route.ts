import { Router } from "express";
import { LeaseController } from "./lease.controller.js";
import { createLeaseSchema, terminateLeaseSchema } from "./lease.validation.js";
import { auth } from "../../middleware/auth.js";
import { UserRole } from "../../lib/prisma.js";
import { validateRequest } from "../../middleware/validateRequest.js";

const router = Router();

// Tenant retrieves their active lease & roommate roster
router.get("/my-lease", auth(UserRole.TENANT), LeaseController.getMyLease);

// Owner/Admin creates an active lease
router.post(
	"/",
	auth(UserRole.OWNER, UserRole.ADMIN),
	validateRequest(createLeaseSchema),
	LeaseController.createLease,
);

// Specific lease details
router.get("/:id", auth(), LeaseController.getLeaseById);

// Owner/Admin terminates a lease
router.post(
	"/:id/terminate",
	auth(UserRole.OWNER, UserRole.ADMIN),
	validateRequest(terminateLeaseSchema),
	LeaseController.terminateLease,
);

export const leaseRoutes = router;
export default router;
