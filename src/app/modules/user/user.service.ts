import httpStatus from "http-status";
import { UserStatus } from "../../../generated/prisma/client";
import { AppError } from "../../utils/AppError.js";
import type { UpdateProfileInput } from "./user.validation.js";
import { prisma } from "../../lib/prisma";

const getMe = async (userId: string) => {
	const user = await prisma.user.findUnique({
		where: { id: userId },
		select: {
			id: true,
			email: true,
			name: true,
			phoneNumber: true,
			avatarUrl: true,
			bio: true,
			role: true,
			status: true,
			createdAt: true,
			updatedAt: true,
			deletedAt: true,
			preference: {
				select: {
					id: true,
					budgetMin: true,
					budgetMax: true,
					cleanlinessLevel: true,
					sleepSchedule: true,
					smokingAllowed: true,
					petsAllowed: true,
					preferredLocations: true,
				},
			},
		},
	});

	if (!user || user.deletedAt !== null) {
		throw new AppError(
			httpStatus.NOT_FOUND,
			"User profile not found or has been deactivated.",
		);
	}

	if (user.status !== UserStatus.ACTIVE) {
		throw new AppError(
			httpStatus.FORBIDDEN,
			`Your account has been ${user.status.toLowerCase()}. Please contact support.`,
		);
	}

	const { deletedAt: _deletedAt, ...sanitizedUser } = user;
	return sanitizedUser;
};

const updateMe = async (
	userId: string,
	payload: UpdateProfileInput,
	ipAddress?: string,
) => {
	const existingUser = await prisma.user.findUnique({
		where: { id: userId },
		select: {
			id: true,
			name: true,
			phoneNumber: true,
			avatarUrl: true,
			bio: true,
			status: true,
			deletedAt: true,
		},
	});

	if (!existingUser || existingUser.deletedAt !== null) {
		throw new AppError(
			httpStatus.NOT_FOUND,
			"User profile not found or has been deactivated.",
		);
	}

	if (existingUser.status !== UserStatus.ACTIVE) {
		throw new AppError(
			httpStatus.FORBIDDEN,
			`Cannot update profile: Account is ${existingUser.status.toLowerCase()}.`,
		);
	}

	const previousState = {
		name: existingUser.name,
		phoneNumber: existingUser.phoneNumber,
		avatarUrl: existingUser.avatarUrl,
		bio: existingUser.bio,
	};

	const updatedUser = await prisma.$transaction(async (tx) => {
		const user = await tx.user.update({
			where: { id: userId },
			data: {
				...(payload.name !== undefined && { name: payload.name }),
				...(payload.phoneNumber !== undefined && {
					phoneNumber: payload.phoneNumber,
				}),
				...(payload.avatarUrl !== undefined && {
					avatarUrl: payload.avatarUrl,
				}),
				...(payload.bio !== undefined && { bio: payload.bio }),
			},
			select: {
				id: true,
				email: true,
				name: true,
				phoneNumber: true,
				avatarUrl: true,
				bio: true,
				role: true,
				status: true,
				updatedAt: true,
			},
		});

		await tx.auditLog.create({
			data: {
				userId,
				action: "PROFILE_UPDATED",
				resource: "users",
				resourceId: userId,
				oldValue: previousState,
				newValue: payload,
				ipAddress: ipAddress ?? null,
			},
		});

		return user;
	});

	return updatedUser;
};

export const UserService = {
	getMe,
	updateMe,
};
