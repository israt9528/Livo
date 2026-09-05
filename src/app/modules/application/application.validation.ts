import { z } from "zod";
import { ApplicationStatus } from "../../lib/prisma";

export const createApplicationSchema = z.object({
	roomId: z
		.string({ error: "roomId is required" })
		.uuid({ message: "roomId must be a valid UUID" }),
	moveInDate: z
		.string({ error: "moveInDate is required" })
		.datetime({ message: "moveInDate must be a valid ISO 8601 date string" })
		.refine((val) => new Date(val) > new Date(), {
			message: "moveInDate must be in the future",
		}),
	intendedDurationMonths: z
		.number({ error: "intendedDurationMonths must be an integer" })
		.int()
		.min(1, { message: "intendedDurationMonths must be at least 1 month" })
		.max(60, { message: "intendedDurationMonths cannot exceed 60 months" }),
	incomeVerificationUrl: z
		.string({ error: "incomeVerificationUrl must be a valid URL string" })
		.url({ message: "incomeVerificationUrl must be a valid URL" })
		.optional(),
});

export const updateApplicationStatusSchema = z.object({
	status: z.enum(
		[
			ApplicationStatus.APPROVED,
			ApplicationStatus.REJECTED,
			ApplicationStatus.CANCELLED,
		] as const,
		{ error: "Status must be 'APPROVED', 'REJECTED', or 'CANCELLED'" },
	),
	rejectionReason: z
		.string({ error: "rejectionReason must be a string" })
		.trim()
		.max(500, { message: "rejectionReason cannot exceed 500 characters" })
		.optional(),
});

export const applicationQuerySchema = z.object({
	page: z.coerce.number().int().positive().default(1),
	limit: z.coerce.number().int().positive().max(100).default(10),
	sortBy: z.string().trim().default("createdAt"),
	sortOrder: z.enum(["asc", "desc"] as const).default("desc"),
	status: z
		.enum([
			ApplicationStatus.PENDING,
			ApplicationStatus.APPROVED,
			ApplicationStatus.REJECTED,
			ApplicationStatus.CANCELLED,
			ApplicationStatus.COMPLETED,
		] as const)
		.optional(),
});

export type CreateApplicationInput = z.infer<typeof createApplicationSchema>;
export type UpdateApplicationStatusInput = z.infer<
	typeof updateApplicationStatusSchema
>;
export type ApplicationQueryInput = z.infer<typeof applicationQuerySchema>;
