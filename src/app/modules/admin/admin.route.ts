import { Router } from "express";
import { AdminController } from "./admin.controller.js";
import {
  adminUserQuerySchema,
  auditLogQuerySchema,
  updateUserRoleSchema,
  updateUserStatusSchema,
} from "./admin.validation.js";
import { auth } from "../../middleware/auth.js";
import { UserRole } from "../../lib/prisma.js";
import { validateRequest } from "../../middleware/validateRequest.js";

const router = Router();

// All endpoints in this router are restricted strictly to ADMIN
router.use(auth(UserRole.ADMIN));
// Platform Overview Analytics Dashboard
router.get("/analytics/overview", AdminController.getPlatformOverviewAnalytics);

// Immutable Audit Logs Ledger
router.get(
  "/audit-logs",
  validateRequest(auditLogQuerySchema),
  AdminController.getAuditLogs,
);

// Global User Registry
router.get(
  "/users",
  validateRequest(adminUserQuerySchema),
  AdminController.getUsers,
);

// Account Status Mutation (Active, Suspended, Deactivated)
router.patch(
  "/users/:id/status",
  validateRequest(updateUserStatusSchema),
  AdminController.updateUserStatus,
);

// Role Mutation (Tenant, Owner, Admin)
router.patch(
  "/users/:id/role",
  validateRequest(updateUserRoleSchema),
  AdminController.updateUserRole,
);

export const adminRoutes = router;
export default router;
