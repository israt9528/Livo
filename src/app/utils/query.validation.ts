import { z } from "zod";

export const baseQuerySchema = z.object({
	page: z.coerce.number().int().positive().default(1),
	limit: z.coerce.number().int().positive().max(100).default(10),
	sortBy: z.string().trim().default("createdAt"),
	sortOrder: z.enum(["asc", "desc"] as const).default("desc"),
	q: z.string().trim().optional(),
});

export type BaseQueryInput = z.infer<typeof baseQuerySchema>;
