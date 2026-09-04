import crypto from "crypto";
import httpStatus from "http-status";
import { hashPassword, comparePassword } from "../../utils/password.js";
import { generateTokenPair, verifyRefreshToken } from "../../utils/jwt.js";
import { AppError } from "../../utils/AppError.js";
import type { RegisterInput, LoginInput } from "./auth.validation.js";
import { prisma } from "../../lib/prisma.js";
import { UserStatus } from "../../../generated/prisma/client.js";

const hashToken = (token: string): string => {
	return crypto.createHash("sha256").update(token).digest("hex");
};

/**
 * Register a new TENANT or OWNER account
 */
const register = async (payload: RegisterInput, ipAddress?: string) => {
	const existingUser = await prisma.user.findUnique({
		where: { email: payload.email.toLowerCase() },
	});

	if (existingUser) {
		throw new AppError(
			httpStatus.CONFLICT,
			"An account with this email already exists.",
		);
	}

	const hashedPassword = await hashPassword(payload.password);

	// Atomic transaction: Create User, hash refresh token, and write AuditLog
	const result = await prisma.$transaction(async (tx) => {
		const newUser = await tx.user.create({
			data: {
				name: payload.name,
				email: payload.email.toLowerCase(),
				passwordHash: hashedPassword,
				phoneNumber: payload.phoneNumber ?? null,
				role: payload.role,
				status: UserStatus.ACTIVE,
			},
			select: {
				id: true,
				email: true,
				name: true,
				phoneNumber: true,
				role: true,
				status: true,
				createdAt: true,
			},
		});

		const tokens = generateTokenPair({
			userId: newUser.id,
			email: newUser.email,
			role: newUser.role,
			status: newUser.status,
		});

		// Save SHA-256 hash of refresh token
		await tx.user.update({
			where: { id: newUser.id },
			data: { refreshTokenHash: hashToken(tokens.refreshToken) },
		});

		// Write initial audit log
		await tx.auditLog.create({
			data: {
				userId: newUser.id,
				action: "USER_REGISTERED",
				resource: "users",
				resourceId: newUser.id,
				newValue: {
					email: newUser.email,
					role: newUser.role,
				},
				ipAddress: ipAddress ?? null,
			},
		});

		return { user: newUser, ...tokens };
	});

	return result;
};

/**
 * Authenticate credentials and issue refreshed session tokens
 */
const login = async (payload: LoginInput, ipAddress?: string) => {
	const user = await prisma.user.findUnique({
		where: { email: payload.email.toLowerCase() },
		select: {
			id: true,
			email: true,
			name: true,
			passwordHash: true,
			role: true,
			status: true,
			deletedAt: true,
		},
	});

	if (!user || user.deletedAt !== null) {
		throw new AppError(httpStatus.UNAUTHORIZED, "Invalid email or password.");
	}

	if (user.status !== UserStatus.ACTIVE) {
		throw new AppError(
			httpStatus.FORBIDDEN,
			`Your account has been ${user.status.toLowerCase()}. Please contact support.`,
		);
	}

	const isPasswordValid = await comparePassword(
		payload.password,
		user.passwordHash,
	);
	if (!isPasswordValid) {
		throw new AppError(httpStatus.UNAUTHORIZED, "Invalid email or password.");
	}

	const tokens = generateTokenPair({
		userId: user.id,
		email: user.email,
		role: user.role,
		status: user.status,
	});

	// Save rotated refresh token hash and record audit entry
	await prisma.$transaction([
		prisma.user.update({
			where: { id: user.id },
			data: { refreshTokenHash: hashToken(tokens.refreshToken) },
		}),
		prisma.auditLog.create({
			data: {
				userId: user.id,
				action: "USER_LOGGED_IN",
				resource: "users",
				resourceId: user.id,
				ipAddress: ipAddress ?? null,
			},
		}),
	]);

	return {
		user: {
			id: user.id,
			email: user.email,
			name: user.name,
			role: user.role,
			status: user.status,
		},
		...tokens,
	};
};

/**
 * Rotate Refresh and Access Tokens
 */
const refreshToken = async (incomingRefreshToken: string) => {
	// 1. Verify token signature
	const decoded = verifyRefreshToken(incomingRefreshToken);

	// 2. Locate user and verify active status
	const user = await prisma.user.findUnique({
		where: { id: decoded.userId },
		select: {
			id: true,
			email: true,
			name: true,
			role: true,
			status: true,
			refreshTokenHash: true,
			deletedAt: true,
		},
	});

	if (!user || user.deletedAt !== null) {
		throw new AppError(httpStatus.UNAUTHORIZED, "User no longer exists.");
	}

	if (user.status !== UserStatus.ACTIVE) {
		throw new AppError(
			httpStatus.FORBIDDEN,
			`Account is ${user.status.toLowerCase()}.`,
		);
	}

	// 3. Cryptographic Token Reuse Detection
	const incomingTokenHash = hashToken(incomingRefreshToken);
	if (!user.refreshTokenHash || user.refreshTokenHash !== incomingTokenHash) {
		// Possible token theft / reuse detected: Invalidate stored token immediately
		await prisma.user.update({
			where: { id: user.id },
			data: { refreshTokenHash: null },
		});
		throw new AppError(
			httpStatus.UNAUTHORIZED,
			"Invalid or expired refresh token. Please log in again.",
		);
	}

	// 4. Issue new token pair (Rotation)
	const newTokens = generateTokenPair({
		userId: user.id,
		email: user.email,
		role: user.role,
		status: user.status,
	});

	// 5. Store new hashed refresh token
	await prisma.user.update({
		where: { id: user.id },
		data: { refreshTokenHash: hashToken(newTokens.refreshToken) },
	});

	return newTokens;
};

/**
 * Revoke active session by clearing refresh token hash
 */
const logout = async (userId: string) => {
	await prisma.user.update({
		where: { id: userId },
		data: { refreshTokenHash: null },
	});

	return true;
};

export const AuthService = {
	register,
	login,
	refreshToken,
	logout,
};
