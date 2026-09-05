import { Request, Response } from "express";
import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync.js";
import { sendResponse } from "../../utils/sendResponse.js";
import { AppError } from "../../utils/AppError.js";
import { PaymentService } from "./payment.service.js";
import { PaymentQueryInput } from "./payment.validation.js";

const createCheckoutSession = catchAsync(
  async (req: Request, res: Response) => {
    if (!req.user?.userId) {
      throw new AppError(
        httpStatus.UNAUTHORIZED,
        "Authentication credentials required",
      );
    }

    const ipAddress = req.ip || req.socket.remoteAddress;
    const result = await PaymentService.createCheckoutSession(
      req.user.userId,
      req.body,
      ipAddress,
    );

    sendResponse(res, {
      statusCode: httpStatus.CREATED,
      success: true,
      message: "Stripe checkout session initialized successfully",
      data: result,
    });
  },
);

const handleWebhook = catchAsync(async (req: Request, res: Response) => {
  const signature = req.headers["stripe-signature"];
  if (!signature || typeof signature !== "string") {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Missing or invalid stripe-signature header",
    );
  }

  // req.body is a raw Buffer because of express.raw()
  await PaymentService.handleStripeWebhook(req.body, signature);

  res.status(httpStatus.OK).json({ received: true });
});

const simulateSuccess = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  if (!id || typeof id !== "string") {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Transaction identifier is required",
    );
  }

  const updatedTx = await PaymentService.settleTransaction(
    id,
    `sim_${Date.now()}`,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message:
      "Payment settled successfully! Status updated to SUCCESS and related split marked PAID.",
    data: updatedTx,
  });
});

const getMyTransactions = catchAsync(async (req: Request, res: Response) => {
  if (!req.user?.userId) {
    throw new AppError(
      httpStatus.UNAUTHORIZED,
      "Authentication credentials required",
    );
  }

  const query = req.query as unknown as PaymentQueryInput;
  const result = await PaymentService.getMyTransactions(req.user.userId, query);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Payment transaction history retrieved successfully",
    data: result,
  });
});

const getTransactionById = catchAsync(async (req: Request, res: Response) => {
  if (!req.user?.userId || !req.user?.role) {
    throw new AppError(
      httpStatus.UNAUTHORIZED,
      "Authentication credentials required",
    );
  }

  const { id } = req.params;
  if (!id || typeof id !== "string") {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "A valid transaction ID is required",
    );
  }

  const transaction = await PaymentService.getTransactionById(
    id,
    req.user.userId,
    req.user.role,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Transaction receipt retrieved successfully",
    data: transaction,
  });
});

export const PaymentController = {
  createCheckoutSession,
  handleWebhook,
  simulateSuccess,
  getMyTransactions,
  getTransactionById,
};
