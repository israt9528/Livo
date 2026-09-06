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
  images: z
    .array(z.string().url({ message: "Each image must be a valid URL" }))
    .default([]),
});

export const unitQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
  sortBy: z.string().trim().default("createdAt"),
  sortOrder: z.enum(["asc", "desc"] as const).default("desc"),
  propertyId: z.string().uuid().optional(),
  floor: z.coerce.number().int().optional(),
});

export type CreateUnitInput = z.infer<typeof createUnitSchema>;
export type UnitQueryInput = z.infer<typeof unitQuerySchema>;
