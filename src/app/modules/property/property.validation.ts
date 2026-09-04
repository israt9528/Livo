import { z } from "zod";
import { PropertyType } from "../../lib/prisma";

export const createPropertySchema = z.object({
	title: z
		.string({ error: "Title is required" })
		.trim()
		.min(3, { message: "Title must be at least 3 characters" })
		.max(150, { message: "Title cannot exceed 150 characters" }),
	description: z
		.string({ error: "Description is required" })
		.trim()
		.min(10, { message: "Description must be at least 10 characters" }),
	address: z
		.string({ error: "Address is required" })
		.trim()
		.min(5, { message: "Address must be at least 5 characters" }),
	city: z
		.string({ error: "City is required" })
		.trim()
		.min(2, { message: "City must be at least 2 characters" }),
	zipCode: z
		.string({ error: "Zip code is required" })
		.trim()
		.min(3, { message: "Zip code must be at least 3 characters" }),
	propertyType: z.enum(
		[
			PropertyType.APARTMENT_BUILDING,
			PropertyType.HOUSE,
			PropertyType.SHARED_CONDO,
		] as const,
		{
			error:
				"Property type must be 'APARTMENT_BUILDING', 'HOUSE', or 'SHARED_CONDO'",
		},
	),
	images: z
		.array(
			z.string().url({ message: "Each image must be a valid URL string" }),
			{
				error: "Images must be an array of URL strings",
			},
		)
		.default([]),
});

export const updatePropertySchema = z.object({
	title: z
		.string({ error: "Title must be a string" })
		.trim()
		.min(3, { message: "Title must be at least 3 characters" })
		.max(150, { message: "Title cannot exceed 150 characters" })
		.optional(),
	description: z
		.string({ error: "Description must be a string" })
		.trim()
		.min(10, { message: "Description must be at least 10 characters" })
		.optional(),
	address: z
		.string({ error: "Address must be a string" })
		.trim()
		.min(5, { message: "Address must be at least 5 characters" })
		.optional(),
	city: z
		.string({ error: "City must be a string" })
		.trim()
		.min(2, { message: "City must be at least 2 characters" })
		.optional(),
	zipCode: z
		.string({ error: "Zip code must be a string" })
		.trim()
		.min(3, { message: "Zip code must be at least 3 characters" })
		.optional(),
	propertyType: z
		.enum(
			[
				PropertyType.APARTMENT_BUILDING,
				PropertyType.HOUSE,
				PropertyType.SHARED_CONDO,
			] as const,
			{
				error:
					"Property type must be 'APARTMENT_BUILDING', 'HOUSE', or 'SHARED_CONDO'",
			},
		)
		.optional(),
	images: z
		.array(z.string().url({ message: "Each image must be a valid URL string" }))
		.optional(),
});

export const propertyQuerySchema = z.object({
	page: z.coerce.number().int().positive().default(1),
	limit: z.coerce.number().int().positive().max(100).default(10),
	sortBy: z.string().trim().default("createdAt"),
	sortOrder: z.enum(["asc", "desc"] as const).default("desc"),
	q: z.string().trim().optional(),
	city: z.string().trim().optional(),
	propertyType: z
		.enum([
			PropertyType.APARTMENT_BUILDING,
			PropertyType.HOUSE,
			PropertyType.SHARED_CONDO,
		] as const)
		.optional(),
});

export type CreatePropertyInput = z.infer<typeof createPropertySchema>;
export type UpdatePropertyInput = z.infer<typeof updatePropertySchema>;
export type PropertyQueryInput = z.infer<typeof propertyQuerySchema>;
