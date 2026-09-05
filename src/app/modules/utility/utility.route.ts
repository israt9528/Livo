import { Router } from "express";
import { UtilityController } from "./utility.controller.js";
import { createUtilityBillSchema } from "./utility.validation.js";
import { auth } from "../../middleware/auth.js";
import { UserRole } from "../../lib/prisma.js";
import { validateRequest } from "../../middleware/validateRequest.js";

const router = Router();

// Tenant queries their assigned utility shares
router.get("/my-splits", auth(UserRole.TENANT), UtilityController.getMySplits);

// Owner/Admin issues a master utility bill for a unit
router.post(
	"/bills",
	auth(UserRole.OWNER, UserRole.ADMIN),
	validateRequest(createUtilityBillSchema),
	UtilityController.createUtilityBill,
);

// Owner/Admin inspects the utility bill ledger for a unit
router.get(
	"/bills/unit/:unitId",
	auth(UserRole.OWNER, UserRole.ADMIN),
	UtilityController.getUnitBills,
);

// Settle utility share (Tenant pays or Owner marks received)
router.patch("/splits/:id/settle", auth(), UtilityController.settleSplit);

export const utilityRoutes = router;
export default router;
