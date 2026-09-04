import { z } from "zod";
import { RoomStatus } from "../../lib/prisma";

export const createRoomSchema = z.object({
	unitId: z
		.string({ error: "unitId is required" })
		.uuid({ message: "unitId must be a valid UUID" }),
	roomNumber: z
		.string({ error: "roomNumber is required" })
		.trim()
		.min(1, { message: "roomNumber cannot be empty" }),
	rentAmount: z
		.number({ error: "rentAmount must be a number" })
		.positive({ message: "rentAmount must be greater than zero" }),
	depositAmount: z
		.number({ error: "depositAmount must be a number" })
		.nonnegative({ message: "depositAmount cannot be negative" }),
	maxOccupancy: z
		.number({ error: "maxOccupancy must be an integer" })
		.int()
		.positive({ message: "maxOccupancy must be at least 1" })
		.default(1),
	features: z
		.array(z.string().trim().min(1), {
			error: "features must be an array of strings",
		})
		.default([]),
	dimensions: z
		.string({ error: "dimensions must be a string" })
		.trim()
		.optional(),
});

export const updateRoomSchema = z.object({
	rentAmount: z
		.number({ error: "rentAmount must be a number" })
		.positive({ message: "rentAmount must be greater than zero" })
		.optional(),
	depositAmount: z
		.number({ error: "depositAmount must be a number" })
		.nonnegative({ message: "depositAmount cannot be negative" })
		.optional(),
	maxOccupancy: z
		.number({ error: "maxOccupancy must be an integer" })
		.int()
		.positive({ message: "maxOccupancy must be at least 1" })
		.optional(),
	features: z.array(z.string().trim().min(1)).optional(),
	dimensions: z.string().trim().optional(),
	status: z
		.enum(
			[
				RoomStatus.AVAILABLE,
				RoomStatus.RESERVED,
				RoomStatus.OCCUPIED,
				RoomStatus.MAINTENANCE,
			] as const,
			{
				error:
					"Invalid status. Allowed: 'AVAILABLE', 'RESERVED', 'OCCUPIED', 'MAINTENANCE'",
			},
		)
		.optional(),
});

export type CreateRoomInput = z.infer<typeof createRoomSchema>;
export type UpdateRoomInput = z.infer<typeof updateRoomSchema>;
