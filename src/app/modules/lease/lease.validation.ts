import { z } from "zod";

export const createLeaseSchema = z
	.object({
		tenantId: z
			.string({ error: "tenantId is required" })
			.uuid({ message: "tenantId must be a valid UUID" }),
		roomId: z
			.string({ error: "roomId is required" })
			.uuid({ message: "roomId must be a valid UUID" }),
		startDate: z
			.string({ error: "startDate is required" })
			.datetime({ message: "startDate must be a valid ISO 8601 date string" }),
		endDate: z
			.string({ error: "endDate is required" })
			.datetime({ message: "endDate must be a valid ISO 8601 date string" }),
		rentAmount: z
			.number({ error: "rentAmount must be a number" })
			.positive({ message: "rentAmount must be greater than zero" }),
		depositAmount: z
			.number({ error: "depositAmount must be a number" })
			.nonnegative({ message: "depositAmount cannot be negative" }),
		terms: z
			.string({ error: "terms must be a string" })
			.trim()
			.max(2000, { message: "terms cannot exceed 2000 characters" })
			.optional(),
	})
	.refine((data) => new Date(data.endDate) > new Date(data.startDate), {
		message: "endDate must be after startDate",
		path: ["endDate"],
	});

export const terminateLeaseSchema = z.object({
	reason: z
		.string({ error: "reason is required" })
		.trim()
		.min(5, { message: "reason must be at least 5 characters" })
		.max(500, { message: "reason cannot exceed 500 characters" }),
});

export type CreateLeaseInput = z.infer<typeof createLeaseSchema>;
export type TerminateLeaseInput = z.infer<typeof terminateLeaseSchema>;
