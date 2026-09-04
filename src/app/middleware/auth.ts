import type { Request, Response, NextFunction } from "express";
import { verifyAccessToken } from "../utils/jwt.js";
import { AppError } from "../utils/AppError.js";
import { catchAsync } from "../utils/catchAsync.js";
import { type UserRole, UserStatus } from "../../generated/prisma/client.js";
import { prisma } from "../lib/prisma.js";

export const auth = (...requiredRoles: UserRole[]) => {
	return catchAsync(
		async (req: Request, _res: Response, next: NextFunction) => {
			// 1. Extract token from Cookie OR Bearer Authorization Header
			const authHeader = req.headers.authorization;
			const token = req.cookies?.accessToken
				? req.cookies.accessToken
				: authHeader?.startsWith("Bearer ")
					? authHeader.split(" ")[1]
					: authHeader;

			if (!token) {
				throw new AppError(
					401,
					"You are not logged in. Please log in to access this resource.",
				);
			}

			// 2. Verify JWT cryptographic signature and expiration
			const decoded = verifyAccessToken(token);

			// 3. Verify Role Permissions (if specific roles are required)
			if (requiredRoles.length > 0 && !requiredRoles.includes(decoded.role)) {
				throw new AppError(
					403,
					"Forbidden. You don't have permission to access this resource.",
				);
			}

			// 4. Fetch user from PostgreSQL using unique ID
			const user = await prisma.user.findUnique({
				where: { id: decoded.userId },
				select: {
					id: true,
					email: true,
					name: true,
					role: true,
					status: true,
					deletedAt: true,
				},
			});

			if (!user || user.deletedAt !== null) {
				throw new AppError(401, "User not found. Please log in again.");
			}

			if (
				user.status === UserStatus.SUSPENDED ||
				user.status === UserStatus.DEACTIVATED
			) {
				throw new AppError(
					403,
					`Your account has been ${user.status.toLowerCase()}. Please contact support.`,
				);
			}

			// 5. Attach verified user profile to Express Request
			req.user = {
				userId: user.id,
				email: user.email,
				name: user.name,
				role: user.role,
			};

			next();
		},
	);
};
