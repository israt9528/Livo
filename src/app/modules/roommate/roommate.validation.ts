import { z } from "zod";
import { SleepSchedule } from "../../../generated/prisma/client";

export const upsertPreferenceSchema = z
	.object({
		budgetMin: z
			.number({ error: "budgetMin must be a number" })
			.nonnegative({ message: "budgetMin cannot be negative" }),
		budgetMax: z
			.number({ error: "budgetMax must be a number" })
			.positive({ message: "budgetMax must be greater than zero" }),
		cleanlinessLevel: z
			.number({ error: "cleanlinessLevel must be an integer between 1 and 5" })
			.int()
			.min(1, { message: "cleanlinessLevel must be at least 1 (relaxed)" })
			.max(5, { message: "cleanlinessLevel cannot exceed 5 (meticulous)" }),
		sleepSchedule: z.enum(
			[
				SleepSchedule.EARLY_BIRD,
				SleepSchedule.NIGHT_OWL,
				SleepSchedule.FLEXIBLE,
			] as const,
			{
				error: "sleepSchedule must be 'EARLY_BIRD', 'NIGHT_OWL', or 'FLEXIBLE'",
			},
		),
		smokingAllowed: z.boolean({
			error: "smokingAllowed must be a boolean",
		}),
		petsAllowed: z.boolean({
			error: "petsAllowed must be a boolean",
		}),
		preferredLocations: z
			.array(
				z.string().trim().min(1, { message: "Location cannot be empty" }),
				{
					error: "preferredLocations must be an array of strings",
				},
			)
			.min(1, { message: "At least one preferred location is required" }),
	})
	.refine((data) => data.budgetMax >= data.budgetMin, {
		message: "budgetMax must be greater than or equal to budgetMin",
		path: ["budgetMax"],
	});

export const roommateMatchQuerySchema = z.object({
	page: z.coerce.number().int().positive().default(1),
	limit: z.coerce.number().int().positive().max(50).default(10),
	minScore: z.coerce.number().min(0).max(100).default(50),
});

export type UpsertPreferenceInput = z.infer<typeof upsertPreferenceSchema>;
export type RoommateMatchQueryInput = z.infer<typeof roommateMatchQuerySchema>;
