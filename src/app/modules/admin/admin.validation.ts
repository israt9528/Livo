import { z } from "zod";
import { UserRole, UserStatus } from "../../lib/prisma";

export const adminUserQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
  sortBy: z.string().trim().default("createdAt"),
  sortOrder: z.enum(["asc", "desc"] as const).default("desc"),
  q: z.string().trim().optional(),
  role: z
    .enum([UserRole.TENANT, UserRole.OWNER, UserRole.ADMIN] as const)
    .optional(),
  status: z
    .enum([
      UserStatus.ACTIVE,
      UserStatus.SUSPENDED,
      UserStatus.DEACTIVATED,
    ] as const)
    .optional(),
});

export const updateUserStatusSchema = z.object({
  status: z.enum(
    [UserStatus.ACTIVE, UserStatus.SUSPENDED, UserStatus.DEACTIVATED] as const,
    { error: "status must be 'ACTIVE', 'SUSPENDED', or 'DEACTIVATED'" },
  ),
  reason: z
    .string({ error: "reason must be a string" })
    .trim()
    .max(500, { message: "reason cannot exceed 500 characters" })
    .optional(),
});

export const updateUserRoleSchema = z.object({
  role: z.enum([UserRole.TENANT, UserRole.OWNER, UserRole.ADMIN] as const, {
    error: "role must be 'TENANT', 'OWNER', or 'ADMIN'",
  }),
});

export type AdminUserQueryInput = z.infer<typeof adminUserQuerySchema>;
export type UpdateUserStatusInput = z.infer<typeof updateUserStatusSchema>;
export type UpdateUserRoleInput = z.infer<typeof updateUserRoleSchema>;
