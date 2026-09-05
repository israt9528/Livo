import { Router } from "express";
import { PaymentController } from "./payment.controller.js";
import { createCheckoutSessionSchema } from "./payment.validation.js";
import { auth } from "../../middleware/auth.js";
import { UserRole } from "../../lib/prisma.js";
import { validateRequest } from "../../middleware/validateRequest.js";

const router = Router();

// Tenant creates a checkout session
router.post(
  "/create-checkout-session",
  auth(UserRole.TENANT),
  validateRequest(createCheckoutSessionSchema),
  PaymentController.createCheckoutSession,
);

// Dev Simulator endpoint: Settle payment and trigger status updates
router.post("/simulate-success/:id", auth(), PaymentController.simulateSuccess);

// Tenant retrieves their transaction history
router.get(
  "/my-transactions",
  auth(UserRole.TENANT),
  PaymentController.getMyTransactions,
);

// Payer, Owner, or Admin retrieves a transaction receipt
router.get("/:id", auth(), PaymentController.getTransactionById);

export const paymentRoutes = router;
export default router;
