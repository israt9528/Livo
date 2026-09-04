import { z } from "zod";
import { UserRole } from "../../../generated/prisma/client";

export const registerSchema = z.object({
	name: z
		.string({ error: "Name is required" })
		.trim()
		.min(2, { message: "Name must be at least 2 characters" })
		.max(100, { message: "Name cannot exceed 100 characters" }),
	email: z
		.string({ error: "Email is required" })
		.trim()
		.email({ message: "Invalid email address format" }),
	password: z
		.string({ error: "Password is required" })
		.min(8, { message: "Password must be at least 8 characters long" })
		.regex(/[A-Z]/, {
			message: "Password must contain at least one uppercase letter",
		})
		.regex(/[a-z]/, {
			message: "Password must contain at least one lowercase letter",
		})
		.regex(/[0-9]/, { message: "Password must contain at least one number" }),
	phoneNumber: z
		.string()
		.trim()
		.regex(/^\+?[1-9]\d{7,14}$/, {
			message: "Invalid phone number format (E.164 recommended)",
		})
		.optional(),
	role: z.enum([UserRole.TENANT, UserRole.OWNER] as const, {
		error: "Role must be either 'TENANT' or 'OWNER'",
	}),
});

export const loginSchema = z.object({
	email: z
		.string({ error: "Email is required" })
		.trim()
		.email({ message: "Invalid email address format" }),
	password: z
		.string({ error: "Password is required" })
		.min(1, { message: "Password cannot be empty" }),
});

export const refreshTokenSchema = z.object({
	refreshToken: z
		.string({ error: "Refresh token is required in request body or cookies" })
		.min(1, { message: "Refresh token cannot be empty" }),
});

// Direct types without .body
export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;
