import { z } from "zod";
import { BillStatus, SplitStatus, UtilityType } from "../../lib/prisma";

export const createUtilityBillSchema = z.object({
	unitId: z
		.string({ error: "unitId is required" })
		.uuid({ message: "unitId must be a valid UUID" }),
	billType: z.enum(
		[
			UtilityType.ELECTRICITY,
			UtilityType.WATER,
			UtilityType.GAS,
			UtilityType.INTERNET,
		] as const,
		{ error: "billType must be 'ELECTRICITY', 'WATER', 'GAS', or 'INTERNET'" },
	),
	totalAmount: z
		.number({ error: "totalAmount must be a number" })
		.positive({ message: "totalAmount must be greater than zero" }),
	dueDate: z
		.string({ error: "dueDate is required" })
		.datetime({ message: "dueDate must be a valid ISO 8601 date string" })
		.refine((val) => new Date(val) > new Date(), {
			message: "dueDate must be scheduled in the future",
		}),
	billingMonth: z
		.string({ error: "billingMonth is required" })
		.trim()
		.regex(/^\d{4}-(0[1-9]|1[0-2])$/, {
			message: "billingMonth must be in YYYY-MM format (e.g., 2026-09)",
		}),
	invoiceUrl: z
		.string({ error: "invoiceUrl must be a valid URL string" })
		.url({ message: "invoiceUrl must be a valid URL" })
		.optional(),
});

export const utilityQuerySchema = z.object({
	page: z.coerce.number().int().positive().default(1),
	limit: z.coerce.number().int().positive().max(100).default(10),
	status: z
		.enum([
			BillStatus.PENDING,
			BillStatus.PARTIALLY_PAID,
			BillStatus.SETTLED,
		] as const)
		.optional(),
	splitStatus: z
		.enum([SplitStatus.UNPAID, SplitStatus.PAID] as const)
		.optional(),
});

export type CreateUtilityBillInput = z.infer<typeof createUtilityBillSchema>;
export type UtilityQueryInput = z.infer<typeof utilityQuerySchema>;
