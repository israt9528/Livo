import { z } from "zod";
import { ViewingStatus } from "../../lib/prisma";

export const createViewingRequestSchema = z.object({
  roomId: z
    .string({ error: "roomId is required" })
    .uuid({ message: "roomId must be a valid UUID" }),
  preferredDate: z
    .string({ error: "preferredDate is required" })
    .datetime({ message: "preferredDate must be a valid ISO 8601 date string" })
    .refine((val) => new Date(val) > new Date(), {
      message: "preferredDate must be scheduled in the future",
    }),
  note: z
    .string({ error: "note must be a string" })
    .trim()
    .max(500, { message: "note cannot exceed 500 characters" })
    .optional(),
});

export const updateViewingStatusSchema = z.object({
  status: z.enum(
    [
      ViewingStatus.CONFIRMED,
      ViewingStatus.REJECTED,
      ViewingStatus.CANCELLED,
    ] as const,
    { error: "Status must be 'CONFIRMED', 'REJECTED', or 'CANCELLED'" },
  ),
  note: z
    .string({ error: "note must be a string" })
    .trim()
    .max(500, { message: "note cannot exceed 500 characters" })
    .optional(),
});

export const viewingQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
  sortBy: z.string().trim().default("createdAt"),
  sortOrder: z.enum(["asc", "desc"] as const).default("desc"),
  status: z
    .enum([
      ViewingStatus.PENDING,
      ViewingStatus.CONFIRMED,
      ViewingStatus.REJECTED,
      ViewingStatus.CANCELLED,
    ] as const)
    .optional(),
});

export type CreateViewingRequestInput = z.infer<
  typeof createViewingRequestSchema
>;
export type UpdateViewingStatusInput = z.infer<
  typeof updateViewingStatusSchema
>;
export type ViewingQueryInput = z.infer<typeof viewingQuerySchema>;
