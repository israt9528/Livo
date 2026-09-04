import { z } from "zod";

export const createUnitSchema = z.object({
	propertyId: z
		.string({ error: "propertyId is required" })
		.uuid({ message: "propertyId must be a valid UUID" }),
	unitNumber: z
		.string({ error: "unitNumber is required" })
		.trim()
		.min(1, { message: "unitNumber cannot be empty" }),
	floor: z
		.number({ error: "floor must be an integer" })
		.int({ message: "floor must be an integer" }),
});

export type CreateUnitInput = z.infer<typeof createUnitSchema>;
