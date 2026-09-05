import { z } from "zod";
import {
  PaymentCategory,
  PaymentStatus,
  PaymentGateway,
} from "../../lib/prisma";

export const createCheckoutSessionSchema = z
  .object({
    category: z.enum(
      [
        PaymentCategory.SECURITY_DEPOSIT,
        PaymentCategory.MONTHLY_RENT,
        PaymentCategory.UTILITY_SPLIT,
      ] as const,
      {
        error:
          "category must be 'SECURITY_DEPOSIT', 'MONTHLY_RENT', or 'UTILITY_SPLIT'",
      },
    ),
    billSplitId: z
      .string()
      .uuid({ message: "billSplitId must be a valid UUID" })
      .optional(),
    leaseId: z
      .string()
      .uuid({ message: "leaseId must be a valid UUID" })
      .optional(),
    applicationId: z
      .string()
      .uuid({ message: "applicationId must be a valid UUID" })
      .optional(),
  })
  .superRefine((data, ctx) => {
    if (data.category === PaymentCategory.UTILITY_SPLIT && !data.billSplitId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "billSplitId is required when category is UTILITY_SPLIT",
        path: ["billSplitId"],
      });
    }

    if (data.category === PaymentCategory.MONTHLY_RENT && !data.leaseId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "leaseId is required when category is MONTHLY_RENT",
        path: ["leaseId"],
      });
    }

    if (
      data.category === PaymentCategory.SECURITY_DEPOSIT &&
      !data.applicationId &&
      !data.leaseId
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Either applicationId or leaseId is required when category is SECURITY_DEPOSIT",
        path: ["applicationId"],
      });
    }
  });

export const paymentQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
  status: z
    .enum([
      PaymentStatus.INITIATED,
      PaymentStatus.SUCCESS,
      PaymentStatus.FAILED,
      PaymentStatus.CANCELLED,
    ] as const)
    .optional(),
  category: z
    .enum([
      PaymentCategory.SECURITY_DEPOSIT,
      PaymentCategory.MONTHLY_RENT,
      PaymentCategory.UTILITY_SPLIT,
    ] as const)
    .optional(),
  gateway: z
    .enum([
      PaymentGateway.STRIPE,
      PaymentGateway.BKASH,
      PaymentGateway.SSLCOMMERZ,
    ] as const)
    .optional(),
});

export type CreateCheckoutSessionInput = z.infer<
  typeof createCheckoutSessionSchema
>;
export type PaymentQueryInput = z.infer<typeof paymentQuerySchema>;
