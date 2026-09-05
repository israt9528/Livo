import crypto from "crypto";
import httpStatus from "http-status";
import Stripe from "stripe";
import {
  BillStatus,
  LeaseStatus,
  PaymentCategory,
  PaymentGateway,
  PaymentStatus,
  prisma,
  SplitStatus,
  UserRole,
} from "../../lib/prisma";
import { AppError } from "../../utils/AppError.js";
import { PaginationUtils } from "../../utils/pagination.js";
import {
  CreateCheckoutSessionInput,
  PaymentQueryInput,
} from "./payment.validation.js";
import { stripe } from "../../lib/stripe";
import { env } from "../../config/env";

const createCheckoutSession = async (
  userId: string,
  payload: CreateCheckoutSessionInput,
  ipAddress?: string,
) => {
  let payableAmount = 0;
  let itemDescription = "";

  if (
    payload.category === PaymentCategory.UTILITY_SPLIT &&
    payload.billSplitId
  ) {
    const split = await prisma.billSplit.findUnique({
      where: { id: payload.billSplitId },
      include: { utilityBill: true },
    });

    if (!split) {
      throw new AppError(
        httpStatus.NOT_FOUND,
        "Target utility split not found",
      );
    }

    if (split.tenantId !== userId) {
      throw new AppError(
        httpStatus.FORBIDDEN,
        "Forbidden: You are not authorized to pay for another tenant’s utility split",
      );
    }

    if (split.status === SplitStatus.PAID) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        "This utility split has already been marked as paid",
      );
    }

    payableAmount = Number(split.amount);
    itemDescription = `Utility Split: ${split.utilityBill.billType} (${split.utilityBill.billingMonth})`;
  } else if (
    payload.category === PaymentCategory.MONTHLY_RENT &&
    payload.leaseId
  ) {
    const lease = await prisma.lease.findUnique({
      where: { id: payload.leaseId },
      include: {
        room: {
          include: {
            unit: {
              include: { property: true },
            },
          },
        },
      },
    });

    if (!lease || lease.deletedAt !== null) {
      throw new AppError(httpStatus.NOT_FOUND, "Active lease record not found");
    }

    if (lease.tenantId !== userId) {
      throw new AppError(
        httpStatus.FORBIDDEN,
        "Forbidden: You can only pay rent for your own lease agreement",
      );
    }

    if (lease.status !== LeaseStatus.ACTIVE) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        `Cannot pay rent on a lease that is ${lease.status.toLowerCase()}`,
      );
    }

    payableAmount = Number(lease.rentAmount);
    itemDescription = `Monthly Rent: ${lease.room.unit.property.title} (Room ${lease.room.roomNumber})`;
  } else if (payload.category === PaymentCategory.SECURITY_DEPOSIT) {
    if (payload.leaseId) {
      const lease = await prisma.lease.findUnique({
        where: { id: payload.leaseId },
      });
      if (!lease || lease.tenantId !== userId) {
        throw new AppError(httpStatus.NOT_FOUND, "Lease record not found");
      }
      payableAmount = Number(lease.depositAmount);
      itemDescription = "Security Deposit Payment (Lease)";
    } else if (payload.applicationId) {
      const app = await prisma.application.findUnique({
        where: { id: payload.applicationId },
        include: { room: true },
      });
      if (!app || app.tenantId !== userId) {
        throw new AppError(httpStatus.NOT_FOUND, "Application not found");
      }
      payableAmount = Number(app.room.depositAmount);
      itemDescription = `Security Deposit Payment (Application for Room ${app.room.roomNumber})`;
    }
  }

  if (payableAmount <= 0) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Invalid payable amount detected. Payment session cannot be initiated.",
    );
  }

  const amountInCents = Math.round(payableAmount * 100);
  const idempotencyKey = crypto.randomUUID();

  const session = await stripe.checkout.sessions.create(
    {
      payment_method_types: ["card"],
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: itemDescription,
            },
            unit_amount: amountInCents,
          },
          quantity: 1,
        },
      ],
      metadata: {
        userId,
        category: payload.category,
        billSplitId: payload.billSplitId ?? "",
        leaseId: payload.leaseId ?? "",
        applicationId: payload.applicationId ?? "",
        idempotencyKey,
      },
      success_url: `${env.CLIENT_URL}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${env.CLIENT_URL}/payment/cancelled?session_id={CHECKOUT_SESSION_ID}`,
    },
    {
      idempotencyKey,
    },
  );

  const transaction = await prisma.$transaction(async (tx) => {
    const newTx = await tx.paymentTransaction.create({
      data: {
        userId,
        amount: payableAmount,
        currency: "USD",
        gateway: PaymentGateway.STRIPE,
        category: payload.category,
        status: PaymentStatus.INITIATED,
        transactionId: session.id,
        idempotencyKey,
        billSplitId: payload.billSplitId ?? null,
        leaseId: payload.leaseId ?? null,
        applicationId: payload.applicationId ?? null,
        metadata: {
          stripeSessionUrl: session.url,
          paymentIntentId: session.payment_intent as string | null,
        },
      },
    });

    await tx.auditLog.create({
      data: {
        userId,
        action: "PAYMENT_SESSION_INITIATED",
        resource: "payment_transactions",
        resourceId: newTx.id,
        newValue: {
          category: payload.category,
          amount: payableAmount,
          gateway: PaymentGateway.STRIPE,
          transactionId: session.id,
        },
        ipAddress: ipAddress ?? null,
      },
    });

    return newTx;
  });

  return {
    transactionId: transaction.transactionId,
    id: transaction.id,
    checkoutUrl: session.url,
    amount: payableAmount,
    currency: "USD",
    category: payload.category,
  };
};

/**
 * Executes state transitions and cascade settlements
 */
const settleTransaction = async (
  transactionId: string,
  gatewayTransactionId?: string,
) => {
  const transaction = await prisma.paymentTransaction.findFirst({
    where: {
      OR: [{ id: transactionId }, { transactionId }],
    },
    include: {
      billSplit: true,
    },
  });

  if (!transaction) {
    throw new AppError(httpStatus.NOT_FOUND, "Transaction record not found");
  }

  // Idempotency: skip if already settled
  if (transaction.status === PaymentStatus.SUCCESS) {
    return transaction;
  }

  const settledAt = new Date();

  const result = await prisma.$transaction(async (tx) => {
    // 1. Update PaymentTransaction to SUCCESS (Removed paidAt since it's not in the model)
    const updatedTx = await tx.paymentTransaction.update({
      where: { id: transaction.id },
      data: {
        status: PaymentStatus.SUCCESS,
        gatewayTransactionId:
          gatewayTransactionId ??
          transaction.gatewayTransactionId ??
          "simulated_success",
      },
    });

    // 2. Cascade status based on category
    if (
      transaction.category === PaymentCategory.UTILITY_SPLIT &&
      transaction.billSplitId
    ) {
      // Mark individual split as PAID
      await tx.billSplit.update({
        where: { id: transaction.billSplitId },
        data: {
          status: SplitStatus.PAID,
          paidAt: settledAt, // This is fine because BillSplit has paidAt
        },
      });

      // Fetch all sibling splits under the parent master bill
      if (transaction.billSplit?.utilityBillId) {
        const allSplits = await tx.billSplit.findMany({
          where: { utilityBillId: transaction.billSplit.utilityBillId },
          select: { status: true },
        });

        const allPaid = allSplits.every((s) => s.status === SplitStatus.PAID);
        const newBillStatus = allPaid
          ? BillStatus.SETTLED
          : BillStatus.PARTIALLY_PAID;

        // Cascade to parent UtilityBill
        await tx.utilityBill.update({
          where: { id: transaction.billSplit.utilityBillId },
          data: { status: newBillStatus },
        });
      }
    }

    // 3. Record Audit Log
    await tx.auditLog.create({
      data: {
        userId: transaction.userId,
        action: "PAYMENT_SETTLED",
        resource: "payment_transactions",
        resourceId: transaction.id,
        oldValue: { status: transaction.status },
        newValue: {
          status: PaymentStatus.SUCCESS,
          category: transaction.category,
          amount: transaction.amount,
          settledAt,
        },
      },
    });

    return updatedTx;
  });

  return result;
};

/**
 * Processes live Stripe Webhook event
 */
const handleStripeWebhook = async (rawBody: Buffer, signature: string) => {
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      env.STRIPE_WEBHOOK_SECRET,
    );
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Unknown signature error";
    throw new AppError(
      httpStatus.BAD_REQUEST,
      `Webhook Signature Verification Failed: ${message}`,
    );
  }

  // Handle successful checkout
  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const gatewayTransactionId =
      (session.payment_intent as string) || session.id;

    await settleTransaction(session.id, gatewayTransactionId);
  }

  // Handle expired checkout
  if (event.type === "checkout.session.expired") {
    const session = event.data.object as Stripe.Checkout.Session;
    await prisma.paymentTransaction.updateMany({
      where: { transactionId: session.id, status: PaymentStatus.INITIATED },
      data: { status: PaymentStatus.CANCELLED },
    });
  }

  return { received: true };
};

const getMyTransactions = async (userId: string, query: PaymentQueryInput) => {
  const { page, limit, skip, take } = PaginationUtils.calculatePagination(
    query,
    "createdAt",
  );

  const whereClause = {
    userId,
    ...(query.status && { status: query.status }),
    ...(query.category && { category: query.category }),
    ...(query.gateway && { gateway: query.gateway }),
  };

  const [total, transactions] = await Promise.all([
    prisma.paymentTransaction.count({ where: whereClause }),
    prisma.paymentTransaction.findMany({
      where: whereClause,
      skip,
      take,
      orderBy: { createdAt: "desc" },
      include: {
        billSplit: {
          select: {
            id: true,
            amount: true,
            status: true,
            utilityBill: {
              select: { billType: true, billingMonth: true },
            },
          },
        },
      },
    }),
  ]);

  const meta = PaginationUtils.formatPaginationMeta(total, page, limit);

  return {
    meta,
    transactions,
  };
};

const getTransactionById = async (
  identifier: string,
  userId: string,
  userRole: UserRole,
) => {
  const transaction = await prisma.paymentTransaction.findFirst({
    where: {
      OR: [{ id: identifier }, { transactionId: identifier }],
    },
    include: {
      user: {
        select: { id: true, name: true, email: true },
      },
      billSplit: {
        include: {
          utilityBill: true,
        },
      },
      lease: {
        include: {
          room: {
            include: {
              unit: {
                include: { property: true },
              },
            },
          },
        },
      },
    },
  });

  if (!transaction) {
    throw new AppError(httpStatus.NOT_FOUND, "Transaction record not found");
  }

  const isPayer = transaction.userId === userId;
  const isAdmin = userRole === UserRole.ADMIN;

  let isPropertyOwner = false;
  if (transaction.lease?.room?.unit?.property?.ownerId === userId) {
    isPropertyOwner = true;
  }

  if (!isPayer && !isAdmin && !isPropertyOwner) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "Forbidden: You are not authorized to view this transaction receipt",
    );
  }

  return transaction;
};

export const PaymentService = {
  createCheckoutSession,
  settleTransaction,
  handleStripeWebhook,
  getMyTransactions,
  getTransactionById,
};
