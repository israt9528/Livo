import jwt, { type SignOptions } from "jsonwebtoken";
import { env } from "../config/env.js";
import { AppError } from "./AppError.js";
import type { UserRole, UserStatus } from "../../generated/prisma/enums.js";

export interface TokenPayload {
	userId: string;
	email: string;
	role: UserRole;
	status: UserStatus;
}

export interface GeneratedTokens {
	accessToken: string;
	refreshToken: string;
}

export const generateTokenPair = (payload: TokenPayload): GeneratedTokens => {
	const signPayload = {
		userId: payload.userId,
		email: payload.email,
		role: payload.role,
		status: payload.status,
	};

	const accessOptions: SignOptions = {
		expiresIn: env.JWT_ACCESS_EXPIRES_IN as unknown as number,
	};

	const refreshOptions: SignOptions = {
		expiresIn: env.JWT_REFRESH_EXPIRES_IN as unknown as number,
	};

	const accessToken = jwt.sign(
		signPayload,
		env.JWT_ACCESS_SECRET,
		accessOptions,
	);
	const refreshToken = jwt.sign(
		signPayload,
		env.JWT_REFRESH_SECRET,
		refreshOptions,
	);

	return { accessToken, refreshToken };
};

export const verifyAccessToken = (token: string): TokenPayload => {
	try {
		return jwt.verify(token, env.JWT_ACCESS_SECRET) as TokenPayload;
	} catch (error) {
		if (error instanceof jwt.TokenExpiredError) {
			throw new AppError(401, "Unauthorized: Access token has expired");
		}
		throw new AppError(401, "Unauthorized: Invalid access token");
	}
};

export const verifyRefreshToken = (token: string): TokenPayload => {
	try {
		return jwt.verify(token, env.JWT_REFRESH_SECRET) as TokenPayload;
	} catch (error) {
		if (error instanceof jwt.TokenExpiredError) {
			throw new AppError(401, "Unauthorized: Refresh token has expired");
		}
		throw new AppError(401, "Unauthorized: Invalid refresh token");
	}
};
