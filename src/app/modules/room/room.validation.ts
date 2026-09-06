import { z } from "zod";
import { RoomStatus } from "../../lib/prisma.js";

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
  images: z
    .array(z.string().url({ message: "Each image must be a valid URL" }))
    .default([]),
});

export const updateRoomSchema = z.object({
  rentAmount: z.number().positive().optional(),
  depositAmount: z.number().nonnegative().optional(),
  maxOccupancy: z.number().int().positive().optional(),
  features: z.array(z.string().trim().min(1)).optional(),
  dimensions: z.string().trim().optional(),
  images: z.array(z.string().url()).optional(),
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

export const roomQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
  sortBy: z.string().trim().default("createdAt"),
  sortOrder: z.enum(["asc", "desc"] as const).default("desc"),
  unitId: z.string().uuid().optional(),
  status: z
    .enum([
      RoomStatus.AVAILABLE,
      RoomStatus.RESERVED,
      RoomStatus.OCCUPIED,
      RoomStatus.MAINTENANCE,
    ] as const)
    .optional(),
  minRent: z.coerce.number().positive().optional(),
  maxRent: z.coerce.number().positive().optional(),
});

export type CreateRoomInput = z.infer<typeof createRoomSchema>;
export type UpdateRoomInput = z.infer<typeof updateRoomSchema>;
export type RoomQueryInput = z.infer<typeof roomQuerySchema>;
